import { randomUUIDv7 } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { PostgresLoadBookingRepository } from '../../src/infrastructure/persistence/postgres-load-booking-repository';
import { LoadReads } from '../../src/application/queries/load-reads';
import { SubmitBooking } from '../../src/application/commands/submit-booking';
import { registerLoadRoutes } from '../../src/interfaces/http/register-load-routes';
import type { IdentityTokenClaims } from '@app/identity-token';
import type { LoadBookingSubmissionRequest } from '../../src/application/ports/load-booking-ports';

const postgresIntegration =
  process.env.CUSTOMER_BOOKING_PG_INTEGRATION === '1' ? describe : describe.skip;
const composeArgs = ['compose', '-f', 'infra/docker-compose.dev.yml'];

function runCompose(...args: string[]): string {
  return execFileSync('docker', [...composeArgs, ...args], {
    encoding: 'utf8',
    timeout: 45_000,
  }).trim();
}

function postgresConnectionDetails() {
  const credentials = runCompose(
    'exec',
    '-T',
    'postgres',
    'sh',
    '-c',
    'printf "%s|%s|%s" "$POSTGRES_USER" "$POSTGRES_PASSWORD" "$POSTGRES_DB"'
  ).split('|');
  const binding = runCompose('port', 'postgres', '5432');
  const hostPort = binding.split(':').at(-1);
  const [user, password, database] = credentials;
  if (!hostPort || !user || password === undefined || !database) {
    throw new Error('Could not determine the conformance PostgreSQL connection settings.');
  }
  return { host: '127.0.0.1', port: Number(hostPort), user, password, database };
}

postgresIntegration('Load booking schema', () => {
  it('creates durable booking tables and enforces revision construction immutability', async () => {
    const schema = `load_b3_${randomUUIDv7().replaceAll('-', '')}`;
    const connection = postgresConnectionDetails();
    const adminPool = new Pool(connection);
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({ ...connection, options: `-c search_path=${schema}` });
    const client = await pool.connect();

    try {
      for (const migrationName of ['001_customer_booking_projection.sql', '002_load_booking.sql']) {
        const migration = readFileSync(
          new URL(`../../migrations/${migrationName}`, import.meta.url),
          'utf8'
        );
        await pool.query(migration);
      }

      const submissionId = randomUUIDv7();
      const loadId = randomUUIDv7();
      const revisionId = randomUUIDv7();
      const customerId = randomUUIDv7();
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO booking_submissions (
           submission_id, initiating_principal_id, idempotency_key,
           normalized_content_hash, outcome, input_schema_version,
           normalized_input, result_schema_version, result_snapshot
         ) VALUES ($1, $2, $3, $4, 'accepted', '1.0.0', '{}'::jsonb, '1.0.0', '{}'::jsonb)`,
        [submissionId, randomUUIDv7(), 'booking-schema-test', Buffer.alloc(32)]
      );
      await client.query(
        `INSERT INTO loads (
           load_id, load_reference, booking_submission_id, source_row_number,
           area_id, area_mapping_revision, handling_broker_principal_id,
           current_revision_id, lifecycle_status, owner_revision
         ) VALUES ($1, 'LD-100000', $2, 1, 'la', 'test-map-v1', $3, $4, 'BOOKED', 1)`,
        [loadId, submissionId, randomUUIDv7(), revisionId]
      );
      await client.query(
        `INSERT INTO load_revisions (
           revision_id, load_id, revision_number, construction_state, customer_id,
           customer_name_snapshot, customer_rate_amount, customer_rate_currency
         ) VALUES ($1, $2, 1, 'BUILDING', $3, 'Customer One', 100.00, 'USD')`,
        [revisionId, loadId, customerId]
      );
      await client.query(
        `INSERT INTO load_revision_stops (
           stop_id, revision_id, sequence_number, stop_type, address_line1,
           city, state_code, postal_code, country_code, appointment_start_at,
           appointment_end_at, time_zone
         ) VALUES ($1, $2, 1, 'PICKUP', '100 Test Street', 'Los Angeles', 'CA',
                   '90001', 'US', now(), now() + interval '1 hour', 'America/Los_Angeles')`,
        [randomUUIDv7(), revisionId]
      );
      await client.query(
        `INSERT INTO load_revision_stops (
           stop_id, revision_id, sequence_number, stop_type, address_line1,
           city, state_code, postal_code, country_code, appointment_start_at,
           appointment_end_at, time_zone
         ) VALUES ($1, $2, 2, 'DELIVERY', '200 Test Street', 'Phoenix', 'AZ',
                   '85001', 'US', now(), now() + interval '1 hour', 'America/Phoenix')`,
        [randomUUIDv7(), revisionId]
      );
      await client.query(
        `INSERT INTO load_revision_freight_lines (
           freight_line_id, revision_id, sequence_number, description, quantity,
           handling_unit_code, stackable
         ) VALUES ($1, $2, 1, 'Test freight', 1, 'PALLET', true)`,
        [randomUUIDv7(), revisionId]
      );
      await client.query(
        `UPDATE load_revisions SET construction_state = 'COMMITTED' WHERE revision_id = $1`,
        [revisionId]
      );
      await client.query('COMMIT');

      await expect(
        client.query(
          `INSERT INTO load_revision_stops (
             stop_id, revision_id, sequence_number, stop_type, address_line1,
             city, state_code, postal_code, country_code, latitude,
             appointment_start_at, appointment_end_at, time_zone
           ) VALUES ($1, $2, 2, 'DELIVERY', '200 Test Street', 'Phoenix', 'AZ',
                     '85001', 'US', 33.4, now(), now() + interval '1 hour', 'America/Phoenix')`,
          [randomUUIDv7(), revisionId]
        )
      ).rejects.toThrow('Load revision children can only be inserted while BUILDING');
    } finally {
      client.release();
      await pool.end();
      await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
      await adminPool.end();
    }
  }, 60_000);

  it('persists accepted and rejected attempts atomically and replays the stored outcome', async () => {
    const schema = `load_b3_${randomUUIDv7().replaceAll('-', '')}`;
    const connection = postgresConnectionDetails();
    const adminPool = new Pool(connection);
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({ ...connection, options: `-c search_path=${schema}` });

    try {
      for (const migrationName of ['001_customer_booking_projection.sql', '002_load_booking.sql']) {
        const migration = readFileSync(
          new URL(`../../migrations/${migrationName}`, import.meta.url),
          'utf8'
        );
        await pool.query(migration);
      }

      const repository = new PostgresLoadBookingRepository(pool);
      const identity: IdentityTokenClaims = {
        iss: 'https://identity.example.test',
        aud: 'tms-api',
        sub: randomUUIDv7(),
        iat: 1,
        exp: 2,
        jti: randomUUIDv7(),
        sid: randomUUIDv7(),
        auth_time: 1,
        amr: ['pwd'],
        grantVersion: 1,
        grants: [{ role: 'broker', scopeType: 'area', scopeId: 'la' }],
      };
      const customerId = randomUUIDv7();
      const request: LoadBookingSubmissionRequest = {
        idempotencyKey: 'accepted-booking',
        rows: [
          {
            customerId,
            customerReference: 'r'.repeat(101),
            customerRate: { amount: '1250.5', currency: 'usd' },
            equipmentProfile: 'DRY_VAN',
            totalGrossWeight: { value: '12000.25', unit: 'lb' },
            stops: [
              {
                type: 'PICKUP',
                address: {
                  addressLine1: '100 Test Street',
                  city: 'Los Angeles',
                  stateCode: 'CA',
                  postalCode: '90001',
                },
                appointmentWindow: {
                  startAt: '2026-10-20T08:00:00-07:00',
                  endAt: '2026-10-20T10:00:00-07:00',
                  timeZone: 'America/Los_Angeles',
                },
              },
              {
                type: 'DELIVERY',
                address: {
                  addressLine1: '200 Test Street',
                  city: 'Phoenix',
                  stateCode: 'AZ',
                  postalCode: '85001',
                },
                appointmentWindow: {
                  startAt: '2026-10-21T08:00:00-07:00',
                  endAt: '2026-10-21T10:00:00-07:00',
                  timeZone: 'America/Phoenix',
                },
              },
            ],
            freightLines: [
              {
                description: 'Test freight',
                quantity: '12',
                handlingUnitCode: 'PALLET',
                stackable: false,
              },
            ],
          },
        ],
      };
      const facts = {
        [customerId]: {
          result: 'FOUND' as const,
          status: 'ACTIVE' as const,
          legalName: 'Customer One',
          ownerRevision: 1,
          registrySequence: 4,
        },
      };

      const accepted = await repository.createSubmission(
        identity,
        request,
        ['la'],
        ['d-515-initial-v1'],
        facts
      );
      expect(accepted.replayed).toBe(false);
      expect(accepted.representation).toMatchObject({
        outcome: 'accepted',
        issues: [],
        loadReferences: [{ rowNumber: 1, loadReference: 'LD-100000' }],
        followUpItems: [
          {
            rowNumber: 1,
            fieldPath: '/rows/0/customerReference',
            code: 'CUSTOMER_REFERENCE_TOO_LONG',
            requiredStage: null,
            blocksStage: false,
          },
        ],
      });

      const loadId = (accepted.representation as { loadReferences: Array<{ loadId: string }> })
        .loadReferences[0]!.loadId;
      const load = await repository.findLoad(loadId);
      expect(load?.representation).toMatchObject({
        loadId,
        currentRevision: {
          customerRate: { amount: '1250.50', currency: 'USD' },
          totalGrossWeight: { value: '12000.250', unit: 'LB' },
          stops: [
            {
              type: 'PICKUP',
              address: { addressLine1: '100 Test Street', stateCode: 'CA' },
              appointmentWindow: { startAt: '2026-10-20T15:00:00Z' },
            },
            { type: 'DELIVERY', address: { city: 'Phoenix' } },
          ],
          freightLines: [
            {
              quantity: '12',
              handlingUnitCode: 'PALLET',
              stackable: false,
            },
          ],
        },
      });
      expect(
        (load?.representation as { currentRevision: Record<string, unknown> }).currentRevision
      ).not.toHaveProperty('customerReference');
      const outboxResult = await pool.query<{
        owner_revision: number;
        payload: Record<string, unknown>;
      }>(
        `SELECT owner_revision, payload
         FROM load_outbox
         WHERE load_id = $1 AND message_type = 'load.booked'`,
        [loadId]
      );
      expect(outboxResult.rows).toHaveLength(1);
      expect(outboxResult.rows[0]).toMatchObject({
        owner_revision: '1',
        payload: {
          messageType: 'load.booked',
          schemaVersion: '1.0.0',
          sourceService: 'load',
          correlationId: accepted.submissionId,
          ownerRevision: 1,
          initiatingPrincipalId: identity.sub,
          payload: {
            loadId,
            bookingSubmissionId: accepted.submissionId,
            sourceRowNumber: 1,
            lifecycleStatus: 'BOOKED',
            loadRevision: {
              revisionId: expect.any(String),
              revisionNumber: 1,
              customerRate: { amount: '1250.50', currency: 'USD' },
              stops: [
                { stopId: expect.any(String), sequenceNumber: 1, type: 'PICKUP' },
                { stopId: expect.any(String), sequenceNumber: 2, type: 'DELIVERY' },
              ],
              freightLines: [{ freightLineId: expect.any(String), sequenceNumber: 1 }],
            },
          },
        },
      });

      await expect(
        repository.publishNextOutboxMessage({
          publish: async () => {
            throw new Error('broker unavailable');
          },
        })
      ).rejects.toThrow('broker unavailable');
      const pendingAfterFailure = await pool.query<{ state: string; published_at: Date | null }>(
        `SELECT state, published_at FROM load_outbox WHERE load_id = $1`,
        [loadId]
      );
      expect(pendingAfterFailure.rows[0]).toEqual({ state: 'pending', published_at: null });

      const publishedMessages: Array<{ routingKey: string; messageId: string; payload: unknown }> =
        [];
      await expect(
        repository.publishNextOutboxMessage({
          publish: async (routingKey, messageId, payload) => {
            publishedMessages.push({ routingKey, messageId, payload });
          },
        })
      ).resolves.toBe(true);
      expect(publishedMessages).toEqual([
        {
          routingKey: 'load.booked.v1',
          messageId: outboxResult.rows[0]!.payload.messageId as string,
          payload: outboxResult.rows[0]!.payload,
        },
      ]);
      const publishedOutbox = await pool.query<{ state: string; published_at: Date | null }>(
        `SELECT state, published_at FROM load_outbox WHERE load_id = $1`,
        [loadId]
      );
      expect(publishedOutbox.rows[0]?.state).toBe('published');
      expect(publishedOutbox.rows[0]?.published_at).toBeInstanceOf(Date);
      await expect(
        repository.publishNextOutboxMessage({ publish: async () => undefined })
      ).resolves.toBe(false);

      const replay = await repository.findIdempotentSubmission(identity, request);
      expect(replay?.result).toMatchObject({ submissionId: accepted.submissionId, replayed: true });
      expect(replay?.authorization).toMatchObject({
        creatorPrincipalId: identity.sub,
        outcome: 'accepted',
        loadAreas: ['la'],
      });
      const semanticallyEquivalentRequest = structuredClone(request);
      const semanticRow = semanticallyEquivalentRequest.rows[0] as Record<string, unknown>;
      semanticRow.customerId = customerId.toUpperCase();
      semanticRow.customerRate = { amount: ' 001250.50 ', currency: ' usd ' };
      semanticRow.equipmentProfile = ' dry_van ';
      const semanticStops = semanticRow.stops as Array<Record<string, unknown>>;
      semanticStops[0]!.type = ' pickup ';
      (semanticStops[0]!.address as Record<string, unknown>).stateCode = ' ca ';
      const semanticFreight = semanticRow.freightLines as Array<Record<string, unknown>>;
      semanticFreight[0]!.quantity = ' 00012 ';
      semanticFreight[0]!.handlingUnitCode = ' pallet ';
      const normalizedReplay = await repository.findIdempotentSubmission(
        identity,
        semanticallyEquivalentRequest
      );
      expect(normalizedReplay?.result).toMatchObject({
        submissionId: accepted.submissionId,
        replayed: true,
      });

      const rejectedRequest: LoadBookingSubmissionRequest = {
        ...request,
        idempotencyKey: 'rejected-booking',
        rows: [{ ...request.rows[0], customerRate: { amount: '0', currency: 'USD' } }],
      };
      const rejected = await repository.createSubmission(
        identity,
        rejectedRequest,
        ['la'],
        ['d-515-initial-v1'],
        facts
      );
      expect(rejected.representation).toMatchObject({
        outcome: 'rejected',
        loadReferences: [],
        followUpItems: [],
      });
      const rejectedAccess = await repository.findSubmission(rejected.submissionId);
      expect(rejectedAccess).toMatchObject({ outcome: 'rejected', loadAreas: ['la'] });
      const rejectedLoadCount = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM loads WHERE booking_submission_id = $1`,
        [rejected.submissionId]
      );
      expect(rejectedLoadCount.rows[0]?.count).toBe('0');

      const missingCustomerRequest: LoadBookingSubmissionRequest = {
        ...request,
        idempotencyKey: 'missing-customer-booking',
      };
      const missingCustomer = await repository.createSubmission(
        identity,
        missingCustomerRequest,
        ['la'],
        ['d-515-initial-v1'],
        { [customerId]: { result: 'NOT_FOUND', registrySequence: 5 } }
      );
      expect(missingCustomer.representation).toMatchObject({
        outcome: 'rejected',
        loadReferences: [],
        followUpItems: [],
        issues: [expect.objectContaining({ code: 'CUSTOMER_NOT_FOUND' })],
      });
      const missingCustomerLoadCount = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM loads
         WHERE booking_submission_id = $1`,
        [missingCustomer.submissionId]
      );
      expect(missingCustomerLoadCount.rows[0]?.count).toBe('0');

      const correctedRequest: LoadBookingSubmissionRequest = {
        ...request,
        idempotencyKey: 'corrected-booking',
        correctionOfSubmissionId: rejected.submissionId,
        rows: [{ ...request.rows[0], customerRate: { amount: '1250.5', currency: 'USD' } }],
      };
      const corrected = await repository.createSubmission(
        identity,
        correctedRequest,
        ['la'],
        ['d-515-initial-v1'],
        facts
      );
      expect(corrected.representation).toMatchObject({
        outcome: 'accepted',
        correctionOfSubmissionId: rejected.submissionId,
      });

      await expect(
        repository.createSubmission(
          identity,
          {
            ...request,
            idempotencyKey: 'invalid-correction-target',
            correctionOfSubmissionId: accepted.submissionId,
          },
          ['la'],
          ['d-515-initial-v1'],
          facts
        )
      ).rejects.toThrow('correction target must be a rejected submission');

      await expect(
        repository.createSubmission(
          identity,
          { ...request, rows: [{ ...request.rows[0], customerReference: 'different' }] },
          ['la'],
          ['d-515-initial-v1'],
          facts
        )
      ).rejects.toThrow('already used with different booking content');

      await pool.query(`
        CREATE FUNCTION reject_second_booking_load() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.source_row_number = 2 THEN
            RAISE EXCEPTION 'injected second-row persistence failure';
          END IF;
          RETURN NEW;
        END;
        $$;
        CREATE TRIGGER reject_second_booking_load
        BEFORE INSERT ON loads
        FOR EACH ROW EXECUTE FUNCTION reject_second_booking_load();
      `);
      await expect(
        repository.createSubmission(
          identity,
          {
            ...request,
            idempotencyKey: 'transaction-rollback',
            rows: [request.rows[0], request.rows[0]],
          },
          ['la', 'la'],
          ['d-515-initial-v1', 'd-515-initial-v1'],
          facts
        )
      ).rejects.toThrow('injected second-row persistence failure');
      const rolledBack = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM booking_submissions
         WHERE initiating_principal_id = $1 AND idempotency_key = 'transaction-rollback'`,
        [identity.sub]
      );
      expect(rolledBack.rows[0]?.count).toBe('0');
      const rolledBackLoads = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM loads`
      );
      expect(rolledBackLoads.rows[0]?.count).toBe('2');

      const server = Fastify();
      try {
        registerLoadRoutes(
          server,
          new LoadReads(repository),
          { verify: async () => identity },
          new SubmitBooking(
            {
              resolveFirstPickupGeographies: async (rows) =>
                rows.map(() => ({ stateFips: '06', countyFips: '037' })),
            },
            repository,
            {
              getUsableOrRequestReconciliation: async () => ({
                available: true,
                fact: facts[customerId]!,
              }),
            }
          )
        );
        const httpRequest = { rows: request.rows };
        const httpBooking = await server.inject({
          method: 'POST',
          url: '/api/v1/booking-submissions',
          headers: {
            authorization: 'Bearer test-token',
            'idempotency-key': 'http-booking-integration',
          },
          payload: httpRequest,
        });
        expect(httpBooking.statusCode).toBe(201);
        const httpRepresentation = httpBooking.json<{
          outcome: string;
          submissionId: string;
          loadReferences: Array<{ loadId: string }>;
        }>();
        expect(httpRepresentation.outcome).toBe('accepted');
        expect(httpBooking.headers.location).toBe(
          `/api/v1/booking-submissions/${httpRepresentation.submissionId}`
        );

        const httpSubmissionRead = await server.inject({
          method: 'GET',
          url: `/api/v1/booking-submissions/${httpRepresentation.submissionId}`,
          headers: { authorization: 'Bearer test-token' },
        });
        expect(httpSubmissionRead.statusCode).toBe(200);
        expect(httpSubmissionRead.json()).toMatchObject({
          submissionId: httpRepresentation.submissionId,
          outcome: 'accepted',
        });

        const httpLoadRead = await server.inject({
          method: 'GET',
          url: `/api/v1/loads/${httpRepresentation.loadReferences[0]!.loadId}`,
          headers: { authorization: 'Bearer test-token' },
        });
        expect(httpLoadRead.statusCode).toBe(200);

        const httpReplay = await server.inject({
          method: 'POST',
          url: '/api/v1/booking-submissions',
          headers: {
            authorization: 'Bearer test-token',
            'idempotency-key': 'http-booking-integration',
          },
          payload: httpRequest,
        });
        expect(httpReplay.statusCode).toBe(200);
        expect(httpReplay.json()).toEqual(httpBooking.json());
      } finally {
        await server.close();
      }
    } finally {
      await pool.end();
      await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
      await adminPool.end();
    }
  }, 60_000);
});
