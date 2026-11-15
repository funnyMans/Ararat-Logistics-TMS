import { randomUUIDv7 } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { runCapacityMigrations } from '../../src/infrastructure/persistence/capacity-migration-runner';
import { PostgresCapacityCommitmentRepository } from '../../src/infrastructure/persistence/postgres-capacity-commitment-repository';
import { capacityCommitmentCommandSchema } from '../../src/interfaces/messaging/capacity-commitment-messages';
import type { CapacityCommitmentCommand } from '../../src/interfaces/messaging/capacity-commitment-messages';

const postgresIntegration =
  process.env.CAPACITY_COMMITMENT_PG_INTEGRATION === '1' ? describe : describe.skip;
const composeArgs = ['compose', '-f', 'infra/docker-compose.dev.yml'];
const migrationDirectory = fileURLToPath(new URL('../../migrations/', import.meta.url));

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

function makeSegment(
  resources: { powerUnitId?: string; trailerId?: string; driverId?: string } = {},
  startAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  endAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
) {
  const powerUnitId = resources.powerUnitId ?? randomUUIDv7();
  const trailerId = resources.trailerId ?? randomUUIDv7();
  const driverId = resources.driverId ?? randomUUIDv7();
  return {
    sequenceNumber: 1,
    startStopId: randomUUIDv7(),
    endStopId: randomUUIDv7(),
    timeWindow: { startAt, endAt },
    powerUnitId,
    trailerId,
    driverIds: [driverId],
    resourceReadinessRevisions: [
      { resourceType: 'POWER_UNIT' as const, resourceId: powerUnitId, ownerRevision: 1 },
      { resourceType: 'TRAILER' as const, resourceId: trailerId, ownerRevision: 1 },
      { resourceType: 'DRIVER' as const, resourceId: driverId, ownerRevision: 1 },
    ],
  };
}

function makeCommand(
  messageType:
    | 'capacity.reservation.reserve'
    | 'capacity.reservation.confirm'
    | 'capacity.reservation.release'
    | 'capacity.reservation.replace',
  payload: Record<string, unknown>,
  scopeKey = randomUUIDv7()
): CapacityCommitmentCommand {
  const parsed = capacityCommitmentCommandSchema.parse({
    messageId: randomUUIDv7(),
    messageType,
    schemaVersion: '1.0.0',
    sourceService: 'dispatch-planning',
    targetService: 'capacity-commitment',
    issuedAt: new Date().toISOString(),
    correlationId: randomUUIDv7(),
    commandId: randomUUIDv7(),
    idempotencyKey: `${messageType}:${scopeKey}`,
    payload,
  });
  return parsed;
}

postgresIntegration('Capacity Commitment persistence', () => {
  it('replays idempotently, commits state transitions, and publishes durable outcomes', async () => {
    const schema = `capacity_cc_${randomUUIDv7().replaceAll('-', '')}`;
    const connection = postgresConnectionDetails();
    const adminPool = new Pool(connection);
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({ ...connection, options: `-c search_path=${schema}` });

    try {
      await runCapacityMigrations(pool, migrationDirectory);
      await runCapacityMigrations(pool, migrationDirectory);
      const appliedMigrations = await pool.query(
        'SELECT version, checksum FROM capacity_schema_migrations ORDER BY version'
      );
      expect(appliedMigrations.rows).toHaveLength(1);
      expect(appliedMigrations.rows[0]?.version).toBe('001_capacity_commitment');
      const appliedChecksum = appliedMigrations.rows[0]?.checksum;
      if (!appliedChecksum) {
        throw new Error('Capacity Commitment migration checksum was not recorded.');
      }

      await pool.query('UPDATE capacity_schema_migrations SET checksum = $1', ['0'.repeat(64)]);
      try {
        await expect(runCapacityMigrations(pool, migrationDirectory)).rejects.toThrow(
          /has changed; add a forward migration instead/
        );
      } finally {
        await pool.query('UPDATE capacity_schema_migrations SET checksum = $1', [appliedChecksum]);
      }

      const repository = new PostgresCapacityCommitmentRepository(pool);
      const segment = makeSegment();
      const tripPlanId = randomUUIDv7();
      const reserve = makeCommand('capacity.reservation.reserve', {
        planningAttemptId: randomUUIDv7(),
        tripPlanId,
        tripPlanRevision: 1,
        segments: [segment],
      });

      const reserved = await repository.execute(reserve);
      const replayed = await repository.execute(reserve);
      expect(replayed).toEqual(reserved);
      expect((reserved.payload as { outcome: string }).outcome).toBe('RESERVED');
      const reservationId = (reserved.payload as { reservationId: string }).reservationId;

      const confirmed = await repository.execute(
        makeCommand(
          'capacity.reservation.confirm',
          {
            reservationId,
            reservationRevision: 1,
            tripPlanId,
            tripPlanRevision: 1,
          },
          reservationId
        )
      );
      expect((confirmed.payload as { outcome: string }).outcome).toBe('CONFIRMED');
      expect((confirmed.payload as { reservationRevision: number }).reservationRevision).toBe(2);
      await expect(
        pool.query('DELETE FROM reservation_claims WHERE reservation_id = $1', [reservationId])
      ).rejects.toThrow('Reservation claims are append-only.');

      const released = await repository.execute(
        makeCommand(
          'capacity.reservation.release',
          {
            reservationId,
            reservationRevision: 2,
            tripPlanId,
            tripPlanRevision: 1,
          },
          reservationId
        )
      );
      expect((released.payload as { outcome: string }).outcome).toBe('RELEASED');
      expect((released.payload as { reservationRevision: number }).reservationRevision).toBe(3);

      await expect(
        repository.publishNextOutboxMessage({
          publish: async () => {
            throw new Error('temporary broker outage');
          },
        })
      ).rejects.toThrow('temporary broker outage');
      const pending = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM capacity_outbox WHERE state = 'pending'`
      );
      expect(Number(pending.rows[0]?.count)).toBe(3);

      let published = 0;
      while (
        await repository.publishNextOutboxMessage({
          publish: async () => {
            published += 1;
          },
        })
      ) {
        // Drain the committed outcomes.
      }
      expect(published).toBe(3);

      const history = await pool.query<{ state: string; reservation_revision: string }>(
        `SELECT state, reservation_revision::text
         FROM reservations WHERE reservation_id = $1`,
        [reservationId]
      );
      expect(history.rows[0]).toEqual({ state: 'RELEASED', reservation_revision: '3' });

      const heldPlanId = randomUUIDv7();
      const held = await repository.execute(
        makeCommand('capacity.reservation.reserve', {
          planningAttemptId: randomUUIDv7(),
          tripPlanId: heldPlanId,
          tripPlanRevision: 1,
          segments: [makeSegment()],
        })
      );
      const heldReservationId = (held.payload as { reservationId: string }).reservationId;
      const heldReplacement = await repository.execute(
        makeCommand(
          'capacity.reservation.replace',
          {
            reservationId: heldReservationId,
            reservationRevision: 1,
            tripPlanId: heldPlanId,
            tripPlanRevision: 1,
            segments: [makeSegment()],
          },
          `${heldReservationId}:replacement`
        )
      );
      expect((heldReplacement.payload as { outcome: string }).outcome).toBe('REPLACED');
      expect((heldReplacement.payload as { newReservationState: string }).newReservationState).toBe(
        'HELD'
      );
      expect(heldReplacement.payload).toHaveProperty('expiresAt');

      const expirySegment = makeSegment();
      const expiredReservationId = randomUUIDv7();
      const expiryCommandId = randomUUIDv7();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO reservations (
             reservation_id, reservation_revision, planning_attempt_id, trip_plan_id,
             trip_plan_revision, state, expires_at, created_at, updated_at
           ) VALUES (
             $1, 1, $2, $3, 1, 'HELD',
             now() - interval '1 minute',
             now() - interval '6 minutes',
             now() - interval '6 minutes'
           )`,
          [expiredReservationId, randomUUIDv7(), randomUUIDv7()]
        );
        await client.query(
          `INSERT INTO reservation_transitions (
             transition_id, reservation_id, reservation_revision, from_state, to_state,
             reason_code, command_id
           ) VALUES ($1, $2, 1, NULL, 'HELD', 'RESERVATION_CREATED', $3)`,
          [randomUUIDv7(), expiredReservationId, expiryCommandId]
        );
        for (const [resourceType, resourceId] of [
          ['POWER_UNIT', expirySegment.powerUnitId],
          ['TRAILER', expirySegment.trailerId],
          ['DRIVER', expirySegment.driverIds[0]],
        ] as const) {
          await client.query(
            `INSERT INTO reservation_claims (
               claim_id, reservation_id, segment_sequence_number, resource_type,
               resource_id, resource_window, claim_state
             ) VALUES (
               $1, $2, 1, $3, $4,
               tstzrange($5::timestamptz, $6::timestamptz, '[)'),
               'HELD'
             )`,
            [
              randomUUIDv7(),
              expiredReservationId,
              resourceType,
              resourceId,
              expirySegment.timeWindow.startAt,
              expirySegment.timeWindow.endAt,
            ]
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      expect(await repository.expireDueHolds()).toBe(1);
      const expired = await pool.query<{ state: string; reservation_revision: string }>(
        `SELECT state, reservation_revision::text
         FROM reservations WHERE reservation_id = $1`,
        [expiredReservationId]
      );
      expect(expired.rows[0]).toEqual({ state: 'EXPIRED', reservation_revision: '2' });
      const expiredClaims = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM reservation_claims
         WHERE reservation_id = $1 AND claim_state = 'EXPIRED'`,
        [expiredReservationId]
      );
      expect(Number(expiredClaims.rows[0]?.count)).toBe(3);
    } finally {
      await pool.end();
      await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
      await adminPool.end();
    }
  }, 20_000);

  it('rejects concurrent overlapping claims without partial reservation writes', async () => {
    const schema = `capacity_race_${randomUUIDv7().replaceAll('-', '')}`;
    const connection = postgresConnectionDetails();
    const adminPool = new Pool(connection);
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({ ...connection, options: `-c search_path=${schema}` });

    try {
      await runCapacityMigrations(pool, migrationDirectory);
      const repository = new PostgresCapacityCommitmentRepository(pool);
      const sharedPowerUnitId = randomUUIDv7();
      const startAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const endAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const first = makeCommand('capacity.reservation.reserve', {
        planningAttemptId: randomUUIDv7(),
        tripPlanId: randomUUIDv7(),
        tripPlanRevision: 1,
        segments: [makeSegment({ powerUnitId: sharedPowerUnitId }, startAt, endAt)],
      });
      const second = makeCommand('capacity.reservation.reserve', {
        planningAttemptId: randomUUIDv7(),
        tripPlanId: randomUUIDv7(),
        tripPlanRevision: 1,
        segments: [makeSegment({ powerUnitId: sharedPowerUnitId }, startAt, endAt)],
      });

      const outcomes = await Promise.all([repository.execute(first), repository.execute(second)]);
      expect(
        outcomes.map((outcome) => (outcome.payload as { outcome: string }).outcome).sort()
      ).toEqual(['REJECTED', 'RESERVED']);

      const counts = await pool.query<{ reservations: string; claims: string }>(
        `SELECT
           (SELECT count(*) FROM reservations)::text AS reservations,
           (SELECT count(*) FROM reservation_claims)::text AS claims`
      );
      expect(counts.rows[0]).toEqual({ reservations: '1', claims: '3' });
      expect(
        outcomes.find((outcome) => (outcome.payload as { outcome: string }).outcome === 'REJECTED')
          ?.payload
      ).toMatchObject({
        reasonCode: 'RESOURCE_UNAVAILABLE',
        replanMayResolve: true,
      });
    } finally {
      await pool.end();
      await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
      await adminPool.end();
    }
  }, 20_000);

  it('preserves a confirmed reservation when a complete replacement conflicts', async () => {
    const schema = `capacity_replace_${randomUUIDv7().replaceAll('-', '')}`;
    const connection = postgresConnectionDetails();
    const adminPool = new Pool(connection);
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({ ...connection, options: `-c search_path=${schema}` });

    try {
      await runCapacityMigrations(pool, migrationDirectory);
      const repository = new PostgresCapacityCommitmentRepository(pool);
      const startAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const endAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const blockedPowerUnitId = randomUUIDv7();
      const blocker = makeCommand('capacity.reservation.reserve', {
        planningAttemptId: randomUUIDv7(),
        tripPlanId: randomUUIDv7(),
        tripPlanRevision: 1,
        segments: [makeSegment({ powerUnitId: blockedPowerUnitId }, startAt, endAt)],
      });
      await repository.execute(blocker);

      const originalPlanId = randomUUIDv7();
      const original = makeCommand('capacity.reservation.reserve', {
        planningAttemptId: randomUUIDv7(),
        tripPlanId: originalPlanId,
        tripPlanRevision: 1,
        segments: [makeSegment({}, startAt, endAt)],
      });
      const originalOutcome = await repository.execute(original);
      const reservationId = (originalOutcome.payload as { reservationId: string }).reservationId;
      await repository.execute(
        makeCommand(
          'capacity.reservation.confirm',
          {
            reservationId,
            reservationRevision: 1,
            tripPlanId: originalPlanId,
            tripPlanRevision: 1,
          },
          reservationId
        )
      );

      const replacementSegment = makeSegment({ powerUnitId: blockedPowerUnitId }, startAt, endAt);
      const replacement = await repository.execute(
        makeCommand(
          'capacity.reservation.replace',
          {
            reservationId,
            reservationRevision: 2,
            tripPlanId: originalPlanId,
            tripPlanRevision: 1,
            segments: [replacementSegment],
          },
          reservationId
        )
      );
      expect((replacement.payload as { outcome: string }).outcome).toBe('REJECTED');
      expect(replacement.payload).toMatchObject({
        reasonCode: 'RESOURCE_UNAVAILABLE',
        reservationId,
        reservationRevision: 2,
        state: 'CONFIRMED',
      });

      const reservation = await pool.query<{ state: string; reservation_revision: string }>(
        `SELECT state, reservation_revision::text
         FROM reservations WHERE reservation_id = $1`,
        [reservationId]
      );
      expect(reservation.rows[0]).toEqual({ state: 'CONFIRMED', reservation_revision: '2' });
      const oldClaims = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM reservation_claims
         WHERE reservation_id = $1 AND claim_state = 'CONFIRMED'`,
        [reservationId]
      );
      expect(Number(oldClaims.rows[0]?.count)).toBe(3);

      const replaced = await repository.execute(
        makeCommand(
          'capacity.reservation.replace',
          {
            reservationId,
            reservationRevision: 2,
            tripPlanId: originalPlanId,
            tripPlanRevision: 1,
            segments: [makeSegment({}, startAt, endAt)],
          },
          `${reservationId}:second-attempt`
        )
      );
      expect((replaced.payload as { outcome: string }).outcome).toBe('REPLACED');
      expect((replaced.payload as { newReservationState: string }).newReservationState).toBe(
        'CONFIRMED'
      );

      const replacedOld = await pool.query<{ state: string; reservation_revision: string }>(
        `SELECT state, reservation_revision::text
         FROM reservations WHERE reservation_id = $1`,
        [reservationId]
      );
      expect(replacedOld.rows[0]).toEqual({ state: 'SUPERSEDED', reservation_revision: '3' });
    } finally {
      await pool.end();
      await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
      await adminPool.end();
    }
  }, 20_000);
});
