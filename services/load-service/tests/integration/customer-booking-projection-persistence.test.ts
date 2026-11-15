import { randomUUIDv7 } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { PostgresCustomerBookingProjectionRepository } from '../../src/infrastructure/persistence/postgres-customer-booking-projection-repository';
import { customerBookingIncomingMessageSchema } from '../../src/interfaces/messaging/customer-booking-messages';

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
  return {
    host: '127.0.0.1',
    port: Number(hostPort),
    user,
    password,
    database,
  };
}

postgresIntegration('Load Customer booking projection persistence', () => {
  it('deduplicates facts, reconciles gaps, and gates bookings until snapshots are current', async () => {
    const schema = `load_b2_${randomUUIDv7().replaceAll('-', '')}`;
    const connection = postgresConnectionDetails();
    const adminPool = new Pool(connection);
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({
      ...connection,
      options: `-c search_path=${schema}`,
    });

    try {
      const migration = readFileSync(
        new URL('../../migrations/001_customer_booking_projection.sql', import.meta.url),
        'utf8'
      );
      await pool.query(migration);
      const repository = new PostgresCustomerBookingProjectionRepository(pool);
      const customerId = randomUUIDv7();
      const missing = await repository.getUsableOrRequestReconciliation(customerId);
      expect(missing).toEqual({ available: false });

      const publisher = {
        publish: async (_routingKey: string, _messageId: string, _payload: unknown) => {},
      };
      await expect(repository.publishNextSnapshotRequest(publisher)).resolves.toBe(true);
      const firstRequest = await pool.query<{ message_id: string }>(
        `SELECT message_id
         FROM load_customer_booking_snapshot_outbox
         WHERE customer_id = $1 AND state = 'published'
         ORDER BY created_at, message_id LIMIT 1`,
        [customerId]
      );
      const requestId = firstRequest.rows[0]?.message_id;
      if (!requestId) {
        throw new Error('The missing Customer snapshot request was not persisted.');
      }

      const initialWatermarkAt = Date.now();
      await expect(
        repository.receive(
          customerBookingIncomingMessageSchema.parse({
            messageId: randomUUIDv7(),
            messageType: 'counterparty.customer.booking-fact.watermark',
            schemaVersion: '1.0.0',
            sourceService: 'counterparty-registry',
            targetService: 'load',
            occurredAt: new Date().toISOString(),
            correlationId: randomUUIDv7(),
            payload: { highWatermarkSequence: 0 },
          }),
          initialWatermarkAt
        )
      ).resolves.toBe('applied');

      await expect(
        repository.receive(
          customerBookingIncomingMessageSchema.parse({
            messageId: randomUUIDv7(),
            messageType: 'counterparty.customer.booking-fact.snapshot.result',
            schemaVersion: '1.0.0',
            sourceService: 'counterparty-registry',
            targetService: 'load',
            occurredAt: new Date().toISOString(),
            correlationId: randomUUIDv7(),
            causationId: requestId,
            payload: { customerId, result: 'NOT_FOUND', registrySequence: 0 },
          })
        )
      ).resolves.toBe('applied');
      await expect(repository.getUsableOrRequestReconciliation(customerId)).resolves.toEqual({
        available: true,
        fact: { result: 'NOT_FOUND', registrySequence: 0 },
      });

      const event = customerBookingIncomingMessageSchema.parse({
        messageId: randomUUIDv7(),
        messageType: 'counterparty.customer.booking-fact.changed',
        schemaVersion: '1.0.0',
        sourceService: 'counterparty-registry',
        targetService: 'load',
        occurredAt: new Date().toISOString(),
        correlationId: randomUUIDv7(),
        ownerRevision: 1,
        registrySequence: 1,
        payload: { customerId, status: 'ACTIVE', legalName: 'Customer One' },
      });
      await expect(repository.receive(event)).resolves.toBe('applied');
      await expect(repository.receive(event)).resolves.toBe('duplicate');
      await expect(
        repository.receive({
          ...event,
          payload: { ...event.payload, status: 'SUSPENDED' },
        })
      ).resolves.toBe('quarantined');
      await expect(repository.getUsableOrRequestReconciliation(customerId)).resolves.toMatchObject({
        available: true,
        fact: { result: 'FOUND', status: 'ACTIVE', ownerRevision: 1 },
      });

      await expect(
        repository.receive(
          customerBookingIncomingMessageSchema.parse({
            messageId: randomUUIDv7(),
            messageType: 'counterparty.customer.booking-fact.changed',
            schemaVersion: '1.0.0',
            sourceService: 'counterparty-registry',
            targetService: 'load',
            occurredAt: new Date().toISOString(),
            correlationId: randomUUIDv7(),
            ownerRevision: 3,
            registrySequence: 3,
            payload: { customerId, status: 'SUSPENDED', legalName: 'Customer Three' },
          })
        )
      ).resolves.toBe('applied');
      expect(await repository.getUsableOrRequestReconciliation(customerId)).toEqual({
        available: false,
      });

      const recoveryWatermarkAt = Date.now();
      const gapWatermark = await repository.receive(
        customerBookingIncomingMessageSchema.parse({
          messageId: randomUUIDv7(),
          messageType: 'counterparty.customer.booking-fact.watermark',
          schemaVersion: '1.0.0',
          sourceService: 'counterparty-registry',
          targetService: 'load',
          occurredAt: new Date().toISOString(),
          correlationId: randomUUIDv7(),
          payload: { highWatermarkSequence: 3 },
        }),
        recoveryWatermarkAt
      );
      expect(gapWatermark).toBe('applied');
      await expect(repository.publishNextSnapshotRequest(publisher)).resolves.toBe(true);
      const gapRequest = await pool.query<{
        message_id: string;
        minimum_registry_sequence: string;
      }>(
        `SELECT message_id, minimum_registry_sequence
         FROM load_customer_booking_snapshot_outbox
         WHERE customer_id = $1 AND state = 'published'
         ORDER BY created_at DESC, message_id DESC LIMIT 1`,
        [customerId]
      );
      expect(gapRequest.rows[0]?.minimum_registry_sequence).toBe('3');

      const weakSnapshot = await repository.receive(
        customerBookingIncomingMessageSchema.parse({
          messageId: randomUUIDv7(),
          messageType: 'counterparty.customer.booking-fact.snapshot.result',
          schemaVersion: '1.0.0',
          sourceService: 'counterparty-registry',
          targetService: 'load',
          occurredAt: new Date().toISOString(),
          correlationId: randomUUIDv7(),
          causationId: gapRequest.rows[0]?.message_id,
          payload: {
            customerId,
            result: 'FOUND',
            status: 'ACTIVE',
            legalName: 'Old Snapshot',
            ownerRevision: 2,
            registrySequence: 2,
          },
        })
      );
      expect(weakSnapshot).toBe('applied');
      await expect(repository.getUsableOrRequestReconciliation(customerId)).resolves.toEqual({
        available: false,
      });
      await expect(repository.publishNextSnapshotRequest(publisher)).resolves.toBe(true);

      const currentRequest = await pool.query<{ message_id: string }>(
        `SELECT message_id
         FROM load_customer_booking_snapshot_outbox
         WHERE customer_id = $1 AND state = 'published'
         ORDER BY created_at DESC, message_id DESC LIMIT 1`,
        [customerId]
      );
      const currentRequestId = currentRequest.rows[0]?.message_id;
      if (!currentRequestId) {
        throw new Error('The stale snapshot was not reconciled with a newer request.');
      }
      await expect(
        repository.receive(
          customerBookingIncomingMessageSchema.parse({
            messageId: randomUUIDv7(),
            messageType: 'counterparty.customer.booking-fact.snapshot.result',
            schemaVersion: '1.0.0',
            sourceService: 'counterparty-registry',
            targetService: 'load',
            occurredAt: new Date().toISOString(),
            correlationId: randomUUIDv7(),
            causationId: currentRequestId,
            payload: {
              customerId,
              result: 'FOUND',
              status: 'SUSPENDED',
              legalName: 'Customer Three',
              ownerRevision: 3,
              registrySequence: 3,
            },
          })
        )
      ).resolves.toBe('applied');
      await expect(repository.getUsableOrRequestReconciliation(customerId)).resolves.toMatchObject({
        available: true,
        fact: { result: 'FOUND', status: 'SUSPENDED', ownerRevision: 3 },
      });

      await repository.expireWatermark(recoveryWatermarkAt + 30_000);
      await expect(repository.getUsableOrRequestReconciliation(customerId)).resolves.toEqual({
        available: false,
      });
      expect(
        (
          await pool.query<{ quarantine_count: string }>(
            `SELECT count(*) AS quarantine_count FROM load_customer_booking_fact_quarantine`
          )
        ).rows[0]?.quarantine_count
      ).toBe('1');
    } finally {
      await pool.end();
      await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
      await adminPool.end();
    }
  }, 60_000);
});
