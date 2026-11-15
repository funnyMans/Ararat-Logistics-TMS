import { randomUUIDv7 } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { RecordCustomerBookingFact } from '../../src/application/commands/record-customer-booking-fact';
import { AnswerCustomerBookingFactSnapshot } from '../../src/application/commands/answer-customer-booking-fact-snapshot';
import { PostgresCounterpartyRegistryRepository } from '../../src/infrastructure/persistence/postgres-counterparty-registry-repository';

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

postgresIntegration('Counterparty Registry Customer booking-fact persistence', () => {
  it('commits owner revisions, ordered facts, confirmed watermarks, and snapshot replies', async () => {
    const schema = `registry_b2_${randomUUIDv7().replaceAll('-', '')}`;
    const connection = postgresConnectionDetails();
    const adminPool = new Pool(connection);
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({
      ...connection,
      options: `-c search_path=${schema}`,
    });

    try {
      const migration = readFileSync(
        new URL('../../migrations/001_customer_booking_facts.sql', import.meta.url),
        'utf8'
      );
      await pool.query(migration);
      const repository = new PostgresCounterpartyRegistryRepository(pool);
      const record = new RecordCustomerBookingFact(repository);
      const answerSnapshot = new AnswerCustomerBookingFactSnapshot(repository);
      const customerId = randomUUIDv7();
      const counterpartyId = randomUUIDv7();
      const actorPrincipalId = randomUUIDv7();
      const base = {
        customerId,
        counterpartyId,
        actorPrincipalId,
        reason: 'integration test',
        status: 'ACTIVE' as const,
      };

      const first = await record.execute({ ...base, legalName: 'Customer One' });
      expect(first).toMatchObject({
        ownerRevision: 1,
        registrySequence: 1,
        payload: { customerId, status: 'ACTIVE', legalName: 'Customer One' },
      });
      await expect(record.execute({ ...base, legalName: 'Customer One' })).resolves.toBeNull();

      const renamed = await record.execute({ ...base, legalName: 'Customer One LLC' });
      expect(renamed).toMatchObject({ ownerRevision: 2, registrySequence: 2 });
      const suspended = await record.execute({
        ...base,
        legalName: 'Customer One LLC',
        status: 'SUSPENDED',
      });
      expect(suspended).toMatchObject({ ownerRevision: 3, registrySequence: 3 });
      expect(
        (
          await pool.query<{ transition_count: string }>(
            `SELECT count(*) AS transition_count FROM customer_profile_transitions`
          )
        ).rows[0]?.transition_count
      ).toBe('2');
      expect(
        (
          await pool.query<{ fact_count: string }>(
            `SELECT count(*) AS fact_count FROM counterparty_registry_outbox
             WHERE message_kind = 'CUSTOMER_BOOKING_FACT'`
          )
        ).rows[0]?.fact_count
      ).toBe('3');

      await expect(
        repository.enqueueCompletenessWatermarkIfDue(new Date('2026-03-20T12:00:00.000Z'))
      ).resolves.toBe(false);
      const delivered: Array<{ routingKey: string; payload: Record<string, unknown> }> = [];
      const publisher = {
        publish: async (routingKey: string, _messageId: string, payload: unknown) => {
          delivered.push({ routingKey, payload: payload as Record<string, unknown> });
        },
      };
      await expect(
        repository.publishNextOutboxMessage({
          publish: async () => {
            throw new Error('broker confirmation failed');
          },
        })
      ).rejects.toThrow('broker confirmation failed');
      expect(
        (
          await pool.query<{ state: string }>(
            `SELECT state FROM counterparty_registry_outbox
             WHERE message_kind = 'CUSTOMER_BOOKING_FACT'
             ORDER BY registry_sequence LIMIT 1`
          )
        ).rows[0]?.state
      ).toBe('pending');

      let hasMore = await repository.publishNextOutboxMessage(publisher);
      while (hasMore) {
        hasMore = await repository.publishNextOutboxMessage(publisher);
      }
      await expect(
        repository.enqueueCompletenessWatermarkIfDue(new Date('2026-03-20T12:00:00.000Z'))
      ).resolves.toBe(true);
      await expect(repository.publishNextOutboxMessage(publisher)).resolves.toBe(true);
      expect(delivered.map(({ routingKey }) => routingKey)).toEqual([
        'counterparty.customer.booking-fact.changed.v1',
        'counterparty.customer.booking-fact.changed.v1',
        'counterparty.customer.booking-fact.changed.v1',
        'counterparty.customer.booking-fact.watermark.v1',
      ]);
      expect(delivered[3]?.payload).toMatchObject({
        payload: { highWatermarkSequence: 3 },
      });

      const request = {
        messageId: randomUUIDv7(),
        messageType: 'counterparty.customer.booking-fact.snapshot.get' as const,
        schemaVersion: '1.0.0' as const,
        sourceService: 'load' as const,
        targetService: 'counterparty-registry' as const,
        issuedAt: '2026-03-20T12:00:10.000Z',
        correlationId: randomUUIDv7(),
        payload: {
          customerId,
          lastAppliedOwnerRevision: 1,
          minimumRegistrySequence: 3,
          reason: 'REVISION_GAP' as const,
        },
      };
      await expect(answerSnapshot.execute(request)).resolves.toBe('queued');
      await expect(answerSnapshot.execute(request)).resolves.toBe('duplicate');
      await expect(
        answerSnapshot.execute({
          ...request,
          payload: { ...request.payload, reason: 'STALE' },
        })
      ).resolves.toBe('quarantined');
      await expect(repository.publishNextOutboxMessage(publisher)).resolves.toBe(true);
      expect(delivered.at(-1)?.payload).toMatchObject({
        messageType: 'counterparty.customer.booking-fact.snapshot.result',
        causationId: request.messageId,
        payload: {
          customerId,
          result: 'FOUND',
          status: 'SUSPENDED',
          legalName: 'Customer One LLC',
          ownerRevision: 3,
          registrySequence: 3,
        },
      });
    } finally {
      await pool.end();
      await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
      await adminPool.end();
    }
  }, 60_000);
});
