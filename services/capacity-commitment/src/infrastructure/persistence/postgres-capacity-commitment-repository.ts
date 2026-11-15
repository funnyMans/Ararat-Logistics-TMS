import { createHash, randomUUIDv7 } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  capacityCommandScopeId,
  findOverlappingSegmentResources,
  getSegmentResources,
  type CapacityCommitmentCommand,
  type CapacityResourceType,
  type CapacitySegment,
} from '../../interfaces/messaging/capacity-commitment-messages';
import type {
  CapacityCommitmentOutcome,
  CapacityCommitmentRepository,
  CapacityOutboxPublisher,
} from '../../application/ports/capacity-commitment-ports';

type ReservationRow = QueryResultRow & {
  reservation_id: string;
  reservation_revision: string;
  planning_attempt_id: string;
  trip_plan_id: string;
  trip_plan_revision: number;
  state: 'HELD' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED' | 'SUPERSEDED';
  expires_at: Date | null;
};

type OutboxRow = QueryResultRow & {
  outbox_id: string;
  message_id: string;
  routing_key: string;
  payload: unknown;
};

type InboxRow = QueryResultRow & {
  request_hash: Buffer;
  outcome_payload: CapacityCommitmentOutcome | null;
};

const routingKeys = {
  'capacity.reservation.reserve': 'capacity.reservation.reserve.outcome.v1',
  'capacity.reservation.confirm': 'capacity.reservation.confirm.outcome.v1',
  'capacity.reservation.release': 'capacity.reservation.release.outcome.v1',
  'capacity.reservation.replace': 'capacity.reservation.replace.outcome.v1',
} as const;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)])
  );
}

function requestHash(command: CapacityCommitmentCommand): Buffer {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(command)))
    .digest();
}

function numberFromBigint(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new RangeError(`${name} is outside the supported safe integer range.`);
  }
  return parsed;
}

function nextRevision(value: string, name: string): number {
  const next = numberFromBigint(value, name) + 1;
  if (!Number.isSafeInteger(next)) {
    throw new RangeError(`${name} exceeds the supported safe integer range.`);
  }
  return next;
}

function isExclusionViolation(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23P01';
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function toOutcome(
  command: CapacityCommitmentCommand,
  payload: Record<string, unknown>,
  occurredAt: string
): CapacityCommitmentOutcome {
  return {
    messageId: randomUUIDv7(),
    messageType: `${command.messageType}.outcome`,
    schemaVersion: '1.0.0',
    sourceService: 'capacity-commitment',
    targetService: 'dispatch-planning',
    occurredAt,
    correlationId: command.correlationId,
    causationId: command.messageId,
    ...(command.initiatingPrincipalId === undefined
      ? {}
      : { initiatingPrincipalId: command.initiatingPrincipalId }),
    payload: {
      commandId: command.commandId,
      ...payload,
    },
  };
}

function segmentConflictDetails(
  conflicts: Array<{
    sequenceNumber: number;
    resourceType: CapacityResourceType;
    resourceId: string;
  }>
) {
  return conflicts.map(({ sequenceNumber, resourceType, resourceId }) => ({
    sequenceNumber,
    resourceType,
    resourceId,
  }));
}

export class CapacityIdempotencyConflictError extends Error {
  constructor() {
    super('A capacity command reused an idempotency scope with different command content.');
    this.name = 'CapacityIdempotencyConflictError';
  }
}

export class PostgresCapacityCommitmentRepository implements CapacityCommitmentRepository {
  constructor(private readonly pool: Pool) {}

  async execute(command: CapacityCommitmentCommand): Promise<CapacityCommitmentOutcome> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.expireDueHoldsWithin(client);

      const scopeId = capacityCommandScopeId(command);
      const hash = requestHash(command);
      let inserted;
      try {
        inserted = await client.query(
          `INSERT INTO capacity_command_inbox (
             source_service, message_type, scope_id, idempotency_key, command_id,
             message_id, request_hash
           ) VALUES ('dispatch-planning', $1, $2, $3, $4, $5, $6)
           ON CONFLICT (source_service, message_type, scope_id, idempotency_key) DO NOTHING
           RETURNING inbox_id`,
          [
            command.messageType,
            scopeId,
            command.idempotencyKey,
            command.commandId,
            command.messageId,
            hash,
          ]
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new CapacityIdempotencyConflictError();
        }
        throw error;
      }

      if (inserted.rowCount === 0) {
        const replay = await client.query<InboxRow>(
          `SELECT request_hash, outcome_payload
           FROM capacity_command_inbox
           WHERE source_service = 'dispatch-planning'
             AND message_type = $1
             AND scope_id = $2
             AND idempotency_key = $3
           FOR UPDATE`,
          [command.messageType, scopeId, command.idempotencyKey]
        );
        const existing = replay.rows[0];
        if (!existing || !existing.request_hash.equals(hash) || !existing.outcome_payload) {
          throw new CapacityIdempotencyConflictError();
        }
        await client.query('COMMIT');
        return existing.outcome_payload;
      }

      const outcome = await this.executeBusinessCommand(client, command);
      const routingKey = routingKeys[command.messageType];
      await client.query(
        `INSERT INTO capacity_outbox (message_id, command_id, routing_key, payload)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [outcome.messageId, command.commandId, routingKey, JSON.stringify(outcome)]
      );
      await client.query(
        `UPDATE capacity_command_inbox
         SET outcome_message_id = $2,
             outcome_routing_key = $3,
             outcome_payload = $4::jsonb
         WHERE command_id = $1`,
        [command.commandId, outcome.messageId, routingKey, JSON.stringify(outcome)]
      );
      await client.query('COMMIT');
      return outcome;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'Capacity command failed and its transaction could not be rolled back.'
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async expireDueHolds(): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const count = await this.expireDueHoldsWithin(client);
      await client.query('COMMIT');
      return count;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'Capacity expiry failed and its transaction could not be rolled back.'
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async publishNextOutboxMessage(publisher: CapacityOutboxPublisher): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<OutboxRow>(
        `SELECT outbox_id, message_id, routing_key, payload
         FROM capacity_outbox
         WHERE state = 'pending'
         ORDER BY outbox_id
         LIMIT 1
         FOR UPDATE SKIP LOCKED`
      );
      const message = result.rows[0];
      if (!message) {
        await client.query('COMMIT');
        return false;
      }

      await publisher.publish(message.routing_key, message.message_id, message.payload);
      await client.query(
        `UPDATE capacity_outbox
         SET state = 'published', published_at = now()
         WHERE outbox_id = $1 AND state = 'pending'`,
        [message.outbox_id]
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'Capacity outbox publication failed and its transaction could not be rolled back.'
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private async executeBusinessCommand(
    client: PoolClient,
    command: CapacityCommitmentCommand
  ): Promise<CapacityCommitmentOutcome> {
    const occurredAtResult = await client.query<{ occurred_at: Date }>(
      'SELECT now() AS occurred_at'
    );
    const occurredAt = occurredAtResult.rows[0]?.occurred_at.toISOString();
    if (!occurredAt) {
      throw new Error('PostgreSQL did not return the capacity command timestamp.');
    }

    switch (command.messageType) {
      case 'capacity.reservation.reserve':
        return this.reserve(client, command, occurredAt);
      case 'capacity.reservation.confirm':
        return this.confirm(client, command, occurredAt);
      case 'capacity.reservation.release':
        return this.release(client, command, occurredAt);
      case 'capacity.reservation.replace':
        return this.replace(client, command, occurredAt);
    }
  }

  private async reserve(
    client: PoolClient,
    command: Extract<CapacityCommitmentCommand, { messageType: 'capacity.reservation.reserve' }>,
    occurredAt: string
  ): Promise<CapacityCommitmentOutcome> {
    const { planningAttemptId, tripPlanId, tripPlanRevision, segments } = command.payload;
    const internalConflicts = findOverlappingSegmentResources(segments);
    if (internalConflicts.length > 0) {
      return toOutcome(
        command,
        {
          planningAttemptId,
          tripPlanId,
          tripPlanRevision,
          outcome: 'REJECTED',
          reasonCode: 'SEGMENT_TIME_CONFLICT',
          message: 'The submitted resource segments overlap.',
          affectedSegments: segmentConflictDetails(internalConflicts),
          replanMayResolve: true,
        },
        occurredAt
      );
    }

    const reservationId = randomUUIDv7();
    const inserted = await this.insertReservationWithClaims(client, {
      reservationId,
      planningAttemptId,
      tripPlanId,
      tripPlanRevision,
      state: 'HELD',
      commandId: command.commandId,
      segments,
    });
    if (!inserted) {
      const affectedSegments = await this.findAvailabilityConflicts(client, segments);
      return toOutcome(
        command,
        {
          planningAttemptId,
          tripPlanId,
          tripPlanRevision,
          outcome: 'REJECTED',
          reasonCode: 'RESOURCE_UNAVAILABLE',
          message: 'One or more requested resources are already reserved for this time window.',
          affectedSegments,
          replanMayResolve: true,
        },
        occurredAt
      );
    }

    const expiresAt = await this.getHoldExpiry(client, reservationId);
    return toOutcome(
      command,
      {
        planningAttemptId,
        tripPlanId,
        tripPlanRevision,
        outcome: 'RESERVED',
        reservationId,
        reservationRevision: 1,
        state: 'HELD',
        expiresAt,
      },
      occurredAt
    );
  }

  private async confirm(
    client: PoolClient,
    command: Extract<CapacityCommitmentCommand, { messageType: 'capacity.reservation.confirm' }>,
    occurredAt: string
  ): Promise<CapacityCommitmentOutcome> {
    const result = await this.lockReservation(client, command.payload.reservationId);
    const reservation = result.rows[0];
    if (!reservation) {
      return toOutcome(
        command,
        {
          ...command.payload,
          outcome: 'REJECTED',
          reasonCode: 'RESERVATION_NOT_FOUND',
          message: 'The reservation does not exist.',
        },
        occurredAt
      );
    }

    const rejection = this.mutationRejection(reservation, command.payload, true);
    if (rejection) {
      return toOutcome(
        command,
        { ...command.payload, outcome: 'REJECTED', ...rejection },
        occurredAt
      );
    }

    const updated = await this.transitionReservation(
      client,
      reservation,
      'CONFIRMED',
      'RESERVATION_CONFIRMED',
      command.commandId,
      null
    );
    return toOutcome(
      command,
      {
        ...command.payload,
        outcome: 'CONFIRMED',
        reservationRevision: updated.reservation_revision,
        state: 'CONFIRMED',
      },
      occurredAt
    );
  }

  private async release(
    client: PoolClient,
    command: Extract<CapacityCommitmentCommand, { messageType: 'capacity.reservation.release' }>,
    occurredAt: string
  ): Promise<CapacityCommitmentOutcome> {
    const result = await this.lockReservation(client, command.payload.reservationId);
    const reservation = result.rows[0];
    if (!reservation) {
      return toOutcome(
        command,
        {
          ...command.payload,
          outcome: 'REJECTED',
          reasonCode: 'RESERVATION_NOT_FOUND',
          message: 'The reservation does not exist.',
        },
        occurredAt
      );
    }

    const rejection = this.mutationRejection(reservation, command.payload, false);
    if (rejection) {
      return toOutcome(
        command,
        {
          ...command.payload,
          outcome: 'REJECTED',
          ...rejection,
          reservationId: reservation.reservation_id,
          reservationRevision: numberFromBigint(
            reservation.reservation_revision,
            'Reservation revision'
          ),
          state: reservation.state,
        },
        occurredAt
      );
    }

    const updated = await this.transitionReservation(
      client,
      reservation,
      'RELEASED',
      'RESERVATION_RELEASED',
      command.commandId,
      null
    );
    return toOutcome(
      command,
      {
        tripPlanId: command.payload.tripPlanId,
        tripPlanRevision: command.payload.tripPlanRevision,
        outcome: 'RELEASED',
        reservationId: reservation.reservation_id,
        reservationRevision: updated.reservation_revision,
        state: 'RELEASED',
      },
      occurredAt
    );
  }

  private async replace(
    client: PoolClient,
    command: Extract<CapacityCommitmentCommand, { messageType: 'capacity.reservation.replace' }>,
    occurredAt: string
  ): Promise<CapacityCommitmentOutcome> {
    const result = await this.lockReservation(client, command.payload.reservationId);
    const reservation = result.rows[0];
    if (!reservation) {
      return toOutcome(
        command,
        {
          ...command.payload,
          outcome: 'REJECTED',
          reasonCode: 'RESERVATION_NOT_FOUND',
          message: 'The reservation does not exist.',
        },
        occurredAt
      );
    }

    const mutation = {
      reservationId: command.payload.reservationId,
      reservationRevision: command.payload.reservationRevision,
      tripPlanId: command.payload.tripPlanId,
      tripPlanRevision: command.payload.tripPlanRevision,
    };
    const rejection = this.mutationRejection(reservation, mutation, false);
    if (rejection) {
      return toOutcome(
        command,
        {
          tripPlanId: command.payload.tripPlanId,
          tripPlanRevision: command.payload.tripPlanRevision,
          outcome: 'REJECTED',
          ...rejection,
          reservationId: reservation.reservation_id,
          reservationRevision: numberFromBigint(
            reservation.reservation_revision,
            'Reservation revision'
          ),
          state: reservation.state,
        },
        occurredAt
      );
    }
    if (reservation.state !== 'HELD' && reservation.state !== 'CONFIRMED') {
      throw new Error('Capacity replacement passed validation with a non-active reservation.');
    }

    const internalConflicts = findOverlappingSegmentResources(command.payload.segments);
    if (internalConflicts.length > 0) {
      return toOutcome(
        command,
        {
          tripPlanId: command.payload.tripPlanId,
          tripPlanRevision: command.payload.tripPlanRevision,
          outcome: 'REJECTED',
          reasonCode: 'SEGMENT_TIME_CONFLICT',
          message: 'The submitted replacement resource segments overlap.',
          reservationId: reservation.reservation_id,
          reservationRevision: numberFromBigint(
            reservation.reservation_revision,
            'Reservation revision'
          ),
          state: reservation.state,
        },
        occurredAt
      );
    }

    const newReservationId = randomUUIDv7();
    const oldRevision = nextRevision(reservation.reservation_revision, 'Reservation revision');
    await client.query('SAVEPOINT capacity_replace');
    try {
      await this.transitionReservation(
        client,
        reservation,
        'SUPERSEDED',
        'RESERVATION_SUPERSEDED',
        command.commandId,
        null
      );
      await this.insertReservationWithClaimsInSavepoint(client, {
        reservationId: newReservationId,
        planningAttemptId: reservation.planning_attempt_id,
        tripPlanId: command.payload.tripPlanId,
        tripPlanRevision: command.payload.tripPlanRevision,
        state: reservation.state,
        commandId: command.commandId,
        segments: command.payload.segments,
      });
      await client.query('SET CONSTRAINTS reservation_claims_no_active_overlap IMMEDIATE');
      await client.query('RELEASE SAVEPOINT capacity_replace');
    } catch (error) {
      if (!isExclusionViolation(error)) {
        throw error;
      }
      await client.query('ROLLBACK TO SAVEPOINT capacity_replace');
      await client.query('RELEASE SAVEPOINT capacity_replace');
      return toOutcome(
        command,
        {
          tripPlanId: command.payload.tripPlanId,
          tripPlanRevision: command.payload.tripPlanRevision,
          outcome: 'REJECTED',
          reasonCode: 'RESOURCE_UNAVAILABLE',
          message: 'One or more replacement resources are already reserved for this time window.',
          reservationId: reservation.reservation_id,
          reservationRevision: numberFromBigint(
            reservation.reservation_revision,
            'Reservation revision'
          ),
          state: reservation.state,
        },
        occurredAt
      );
    }

    const newExpiresAt =
      reservation.state === 'HELD' ? await this.getHoldExpiry(client, newReservationId) : undefined;
    return toOutcome(
      command,
      {
        tripPlanId: command.payload.tripPlanId,
        tripPlanRevision: command.payload.tripPlanRevision,
        outcome: 'REPLACED',
        oldReservationId: reservation.reservation_id,
        oldReservationRevision: oldRevision,
        oldReservationState: 'SUPERSEDED',
        newReservationId,
        newReservationRevision: 1,
        newReservationState: reservation.state,
        ...(newExpiresAt === undefined ? {} : { expiresAt: newExpiresAt }),
      },
      occurredAt
    );
  }

  private async insertReservationWithClaims(
    client: PoolClient,
    input: {
      reservationId: string;
      planningAttemptId: string;
      tripPlanId: string;
      tripPlanRevision: number;
      state: 'HELD' | 'CONFIRMED';
      commandId: string;
      segments: CapacitySegment[];
    }
  ): Promise<boolean> {
    await client.query('SAVEPOINT capacity_reserve');
    try {
      await this.insertReservationWithClaimsInSavepoint(client, input);
      await client.query('SET CONSTRAINTS reservation_claims_no_active_overlap IMMEDIATE');
      await client.query('RELEASE SAVEPOINT capacity_reserve');
      return true;
    } catch (error) {
      if (!isExclusionViolation(error)) {
        throw error;
      }
      await client.query('ROLLBACK TO SAVEPOINT capacity_reserve');
      await client.query('RELEASE SAVEPOINT capacity_reserve');
      return false;
    }
  }

  private async insertReservationWithClaimsInSavepoint(
    client: PoolClient,
    input: {
      reservationId: string;
      planningAttemptId: string;
      tripPlanId: string;
      tripPlanRevision: number;
      state: 'HELD' | 'CONFIRMED';
      commandId: string;
      segments: CapacitySegment[];
    }
  ): Promise<void> {
    const expiry = input.state === 'HELD' ? `now() + interval '5 minutes'` : 'NULL';
    const inserted = await client.query(
      `INSERT INTO reservations (
         reservation_id, reservation_revision, planning_attempt_id, trip_plan_id,
         trip_plan_revision, state, expires_at, created_at, updated_at
       ) VALUES ($1, 1, $2, $3, $4, $5, ${expiry}, now(), now())
       RETURNING reservation_id`,
      [
        input.reservationId,
        input.planningAttemptId,
        input.tripPlanId,
        input.tripPlanRevision,
        input.state,
      ]
    );
    if (!inserted.rows[0]) {
      throw new Error('Capacity reservation insert did not return its identity.');
    }

    await client.query(
      `INSERT INTO reservation_transitions (
         transition_id, reservation_id, reservation_revision, from_state, to_state,
         reason_code, command_id
       ) VALUES ($1, $2, 1, NULL, $3, 'RESERVATION_CREATED', $4)`,
      [randomUUIDv7(), input.reservationId, input.state, input.commandId]
    );

    for (const segment of input.segments) {
      for (const resource of getSegmentResources(segment)) {
        await client.query(
          `INSERT INTO reservation_claims (
             claim_id, reservation_id, segment_sequence_number, resource_type,
             resource_id, resource_window, claim_state
           ) VALUES (
             $1, $2, $3, $4, $5,
             tstzrange($6::timestamptz, $7::timestamptz, '[)'),
             $8
           )`,
          [
            randomUUIDv7(),
            input.reservationId,
            segment.sequenceNumber,
            resource.resourceType,
            resource.resourceId,
            segment.timeWindow.startAt,
            segment.timeWindow.endAt,
            input.state,
          ]
        );
      }
    }
  }

  private async transitionReservation(
    client: PoolClient,
    reservation: ReservationRow,
    state: 'CONFIRMED' | 'RELEASED' | 'EXPIRED' | 'SUPERSEDED',
    reasonCode: string,
    commandId: string,
    expiresAt: string | null
  ): Promise<{ reservation_revision: number }> {
    const revision = nextRevision(reservation.reservation_revision, 'Reservation revision');
    await client.query(
      `UPDATE reservations
       SET state = $2,
           reservation_revision = $3,
           expires_at = $4,
           updated_at = now()
       WHERE reservation_id = $1`,
      [reservation.reservation_id, state, revision, expiresAt]
    );
    await client.query(
      `INSERT INTO reservation_transitions (
         transition_id, reservation_id, reservation_revision, from_state, to_state,
         reason_code, command_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUIDv7(),
        reservation.reservation_id,
        revision,
        reservation.state,
        state,
        reasonCode,
        commandId,
      ]
    );
    return { reservation_revision: revision };
  }

  private async lockReservation(client: PoolClient, reservationId: string) {
    return client.query<ReservationRow>(
      `SELECT reservation_id, reservation_revision, planning_attempt_id, trip_plan_id,
              trip_plan_revision, state, expires_at
       FROM reservations
       WHERE reservation_id = $1
       FOR UPDATE`,
      [reservationId]
    );
  }

  private mutationRejection(
    reservation: ReservationRow,
    payload: {
      reservationRevision: number;
      tripPlanId: string;
      tripPlanRevision: number;
    },
    confirmation: boolean
  ): { reasonCode: string; message: string } | undefined {
    if (confirmation && reservation.state !== 'HELD') {
      return {
        reasonCode: 'RESERVATION_NOT_HELD',
        message: 'Only a held reservation can be confirmed.',
      };
    }
    if (!confirmation && reservation.state !== 'HELD' && reservation.state !== 'CONFIRMED') {
      return {
        reasonCode: 'RESERVATION_NOT_ACTIVE',
        message: 'The reservation is no longer active.',
      };
    }
    if (
      numberFromBigint(reservation.reservation_revision, 'Reservation revision') !==
      payload.reservationRevision
    ) {
      return {
        reasonCode: 'RESERVATION_REVISION_MISMATCH',
        message: 'The reservation revision is stale.',
      };
    }
    if (
      reservation.trip_plan_id !== payload.tripPlanId ||
      reservation.trip_plan_revision !== payload.tripPlanRevision
    ) {
      return {
        reasonCode: 'TRIP_PLAN_REVISION_MISMATCH',
        message: 'The Trip Plan reference is stale.',
      };
    }
    return undefined;
  }

  private async findAvailabilityConflicts(client: PoolClient, segments: CapacitySegment[]) {
    const affected = new Map<
      string,
      { sequenceNumber: number; resourceType: CapacityResourceType; resourceId: string }
    >();
    for (const segment of segments) {
      for (const resource of getSegmentResources(segment)) {
        const result = await client.query(
          `SELECT 1
           FROM reservation_claims
           WHERE claim_state IN ('HELD', 'CONFIRMED')
             AND resource_type = $1
             AND resource_id = $2
             AND resource_window && tstzrange($3::timestamptz, $4::timestamptz, '[)')
           LIMIT 1`,
          [
            resource.resourceType,
            resource.resourceId,
            segment.timeWindow.startAt,
            segment.timeWindow.endAt,
          ]
        );
        if (result.rowCount) {
          affected.set(
            `${segment.sequenceNumber}:${resource.resourceType}:${resource.resourceId}`,
            {
              sequenceNumber: segment.sequenceNumber,
              resourceType: resource.resourceType,
              resourceId: resource.resourceId,
            }
          );
        }
      }
    }
    return [...affected.values()].sort(
      (left, right) =>
        left.sequenceNumber - right.sequenceNumber ||
        left.resourceType.localeCompare(right.resourceType) ||
        left.resourceId.localeCompare(right.resourceId)
    );
  }

  private async getHoldExpiry(client: PoolClient, reservationId: string): Promise<string> {
    const result = await client.query<{ expires_at: Date }>(
      'SELECT expires_at FROM reservations WHERE reservation_id = $1',
      [reservationId]
    );
    const expiresAt = result.rows[0]?.expires_at.toISOString();
    if (!expiresAt) {
      throw new Error('A HELD reservation must have a persisted expiry.');
    }
    return expiresAt;
  }

  private async expireDueHoldsWithin(client: PoolClient): Promise<number> {
    const expired = await client.query<ReservationRow>(
      `SELECT reservation_id, reservation_revision, planning_attempt_id, trip_plan_id,
              trip_plan_revision, state, expires_at
       FROM reservations
       WHERE state = 'HELD' AND expires_at <= now()
       ORDER BY expires_at, reservation_id
       FOR UPDATE SKIP LOCKED`
    );
    for (const reservation of expired.rows) {
      await this.transitionReservation(
        client,
        reservation,
        'EXPIRED',
        'HOLD_EXPIRED',
        randomUUIDv7(),
        null
      );
    }
    return expired.rowCount ?? 0;
  }
}
