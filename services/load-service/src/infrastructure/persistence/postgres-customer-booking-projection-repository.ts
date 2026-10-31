import { createHash, randomUUIDv7 } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  applyCustomerBookingFact,
  applyCustomerBookingSnapshot,
  applyCustomerBookingWatermark,
  customerBookingFactIsUsable,
  expireCustomerBookingWatermark,
} from '../../domain/customer-booking/customer-booking-projection';
import type {
  CustomerBookingFact,
  CustomerBookingFactSnapshot,
  CustomerBookingProjectionState,
  CustomerBookingSnapshotRequest,
  ProjectionTransition,
} from '../../domain/customer-booking/customer-booking-projection';
import type {
  CustomerBookingFactResult,
  CustomerBookingFactLookup,
  LoadCustomerBookingFactReader,
} from '../../application/ports/load-booking-ports';
import type { CustomerBookingIncomingMessage } from '../../interfaces/messaging/customer-booking-messages';

type ProjectionStateRow = QueryResultRow & {
  initialized: boolean;
  contiguous_registry_sequence: string;
  observed_registry_sequence: string;
  last_watermark_sequence: string;
  last_watermark_at: Date | null;
  stream_stale: boolean;
  reconciliation_sequence: string | null;
};

type ProjectionFactRow = QueryResultRow & {
  customer_id: string;
  result: 'FOUND' | 'NOT_FOUND';
  status: string | null;
  legal_name: string | null;
  owner_revision: string;
  registry_sequence: string;
  stale: boolean;
  observed_owner_revision: string;
};

type ProjectionLookupRow = QueryResultRow &
  ProjectionStateRow & {
    customer_id: string | null;
    result: ProjectionFactRow['result'] | null;
    status: string | null;
    legal_name: string | null;
    owner_revision: string | null;
    registry_sequence: string | null;
    stale: boolean | null;
    observed_owner_revision: string | null;
  };

type TransactionResult<T> = {
  value: T;
  state: CustomerBookingProjectionState;
  snapshotRequests: CustomerBookingSnapshotRequest[];
};

type IncomingResult = 'applied' | 'duplicate' | 'quarantined';

export interface CustomerBookingSnapshotPublisher {
  publish(routingKey: string, messageId: string, payload: unknown): Promise<void>;
}

const STREAM_KEY = 'counterparty-customer-booking-facts-v1';
const SNAPSHOT_REQUEST_ROUTING_KEY = 'counterparty.customer.booking-fact.snapshot.get.v1';
const CUSTOMER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeNumber(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new RangeError(`Persisted Customer fact sequence "${value}" is outside the safe range.`);
  }
  return parsed;
}

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

function contentHash(message: CustomerBookingIncomingMessage): Buffer {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(message)))
    .digest();
}

function readFact(row: ProjectionFactRow): CustomerBookingFact {
  const registrySequence = safeNumber(row.registry_sequence);
  const ownerRevision = safeNumber(row.owner_revision);
  const observedOwnerRevision = safeNumber(row.observed_owner_revision);
  if (registrySequence === null || ownerRevision === null || observedOwnerRevision === null) {
    throw new Error('Persisted Customer booking fact is missing a required sequence value.');
  }
  if (row.result === 'FOUND') {
    if (row.status === null || row.legal_name === null) {
      throw new Error('Persisted FOUND Customer booking fact is incomplete.');
    }
    return {
      customerId: row.customer_id,
      result: 'FOUND',
      status: row.status as 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED',
      legalName: row.legal_name,
      ownerRevision,
      registrySequence,
      stale: row.stale,
      observedOwnerRevision,
    };
  }
  return {
    customerId: row.customer_id,
    result: 'NOT_FOUND',
    registrySequence,
    stale: row.stale,
    observedOwnerRevision,
  };
}

function readLookupFact(row: ProjectionLookupRow): CustomerBookingFact | null {
  if (row.customer_id === null) {
    return null;
  }
  if (
    row.result === null ||
    row.owner_revision === null ||
    row.registry_sequence === null ||
    row.stale === null ||
    row.observed_owner_revision === null
  ) {
    throw new Error('Persisted Customer booking fact is incomplete.');
  }
  return readFact({
    customer_id: row.customer_id,
    result: row.result,
    status: row.status,
    legal_name: row.legal_name,
    owner_revision: row.owner_revision,
    registry_sequence: row.registry_sequence,
    stale: row.stale,
    observed_owner_revision: row.observed_owner_revision,
  });
}

function readProjectionState(row: ProjectionStateRow, facts: CustomerBookingFact[]) {
  const contiguousRegistrySequence = safeNumber(row.contiguous_registry_sequence);
  const observedRegistrySequence = safeNumber(row.observed_registry_sequence);
  const lastWatermarkSequence = safeNumber(row.last_watermark_sequence);
  const reconciliationSequence = safeNumber(row.reconciliation_sequence);
  if (
    contiguousRegistrySequence === null ||
    observedRegistrySequence === null ||
    lastWatermarkSequence === null
  ) {
    throw new Error('Persisted Customer booking stream state is incomplete.');
  }
  return {
    initialized: row.initialized,
    contiguousRegistrySequence,
    observedRegistrySequence,
    lastWatermarkSequence,
    lastWatermarkAt: row.last_watermark_at?.getTime() ?? null,
    streamStale: row.stream_stale,
    reconciliationSequence,
    facts: Object.fromEntries(facts.map((fact) => [fact.customerId, fact])),
  } satisfies CustomerBookingProjectionState;
}

function resultFromFact(fact: CustomerBookingFact): CustomerBookingFactResult {
  if (fact.result === 'FOUND') {
    return {
      result: 'FOUND',
      status: fact.status,
      legalName: fact.legalName,
      ownerRevision: fact.ownerRevision,
      registrySequence: fact.registrySequence,
    };
  }
  return { result: 'NOT_FOUND', registrySequence: fact.registrySequence };
}

export class PostgresCustomerBookingProjectionRepository implements LoadCustomerBookingFactReader {
  constructor(private readonly pool: Pool) {}

  async receive(
    message: CustomerBookingIncomingMessage,
    receivedAt = Date.now()
  ): Promise<IncomingResult> {
    const hash = contentHash(message);
    return this.withLockedProjection(async (client, state) => {
      const inboxInsert = await client.query(
        `INSERT INTO load_customer_booking_fact_inbox (message_id, content_hash)
         VALUES ($1, $2)
         ON CONFLICT (message_id) DO NOTHING
         RETURNING message_id`,
        [message.messageId, hash]
      );

      if (inboxInsert.rowCount === 0) {
        const existing = await client.query<{ content_hash: Buffer }>(
          `SELECT content_hash FROM load_customer_booking_fact_inbox WHERE message_id = $1`,
          [message.messageId]
        );
        const previousHash = existing.rows[0]?.content_hash;
        if (!previousHash) {
          throw new Error('Inbox conflict occurred but the original message hash was not found.');
        }
        if (previousHash.equals(hash)) {
          return { value: 'duplicate', state, snapshotRequests: [] };
        }
        await client.query(
          `INSERT INTO load_customer_booking_fact_quarantine
             (message_id, original_content_hash, conflicting_content_hash, reason)
           VALUES ($1, $2, $3, 'MESSAGE_ID_CONTENT_CONFLICT')`,
          [message.messageId, previousHash, hash]
        );
        return { value: 'quarantined', state, snapshotRequests: [] };
      }

      let transition: ProjectionTransition;
      if (message.messageType === 'counterparty.customer.booking-fact.changed') {
        transition = applyCustomerBookingFact(state, {
          customerId: message.payload.customerId,
          status: message.payload.status,
          legalName: message.payload.legalName,
          ownerRevision: message.ownerRevision,
          registrySequence: message.registrySequence,
        });
      } else if (message.messageType === 'counterparty.customer.booking-fact.watermark') {
        transition = applyCustomerBookingWatermark(
          state,
          message.payload.highWatermarkSequence,
          receivedAt
        );
      } else {
        const request = await client.query<{
          customer_id: string;
          minimum_registry_sequence: string;
          state: string;
        }>(
          `SELECT customer_id, minimum_registry_sequence, state
           FROM load_customer_booking_snapshot_outbox
           WHERE message_id = $1
           FOR UPDATE`,
          [message.causationId]
        );
        const pending = request.rows[0];
        if (
          !pending ||
          pending.state !== 'published' ||
          pending.customer_id !== message.payload.customerId
        ) {
          await client.query(
            `INSERT INTO load_customer_booking_fact_quarantine
               (message_id, original_content_hash, conflicting_content_hash, reason)
             VALUES ($1, $2, $2, 'UNMATCHED_SNAPSHOT_RESULT')`,
            [message.messageId, hash]
          );
          return { value: 'quarantined', state, snapshotRequests: [] };
        }
        const minimumRegistrySequence = safeNumber(pending.minimum_registry_sequence);
        if (minimumRegistrySequence === null) {
          throw new Error('Snapshot request is missing its minimum Registry sequence.');
        }
        const snapshot: CustomerBookingFactSnapshot = message.payload;
        transition = applyCustomerBookingSnapshot(state, snapshot, minimumRegistrySequence);
        await client.query(
          `UPDATE load_customer_booking_snapshot_outbox
           SET state = 'completed'
           WHERE message_id = $1`,
          [message.causationId]
        );
      }

      return {
        value: 'applied',
        state: transition.state,
        snapshotRequests: transition.snapshotRequests,
      };
    });
  }

  async expireWatermark(now = Date.now()): Promise<void> {
    await this.withLockedProjection(async (_client, state) => {
      const transition = expireCustomerBookingWatermark(state, now);
      return { value: undefined, ...transition };
    });
  }

  async publishNextSnapshotRequest(publisher: CustomerBookingSnapshotPublisher): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const stateResult = await client.query(
        `SELECT stream_key
         FROM load_customer_booking_projection_state
         WHERE stream_key = $1
         FOR UPDATE`,
        [STREAM_KEY]
      );
      if (stateResult.rowCount !== 1) {
        throw new Error('Load Customer booking projection migration has not been applied.');
      }
      const result = await client.query<{
        message_id: string;
        payload: unknown;
      }>(
        `SELECT message_id, payload
         FROM load_customer_booking_snapshot_outbox
         WHERE state = 'pending'
         ORDER BY created_at, message_id
         LIMIT 1
         FOR UPDATE`
      );
      const request = result.rows[0];
      if (!request) {
        await client.query('COMMIT');
        return false;
      }
      await publisher.publish(SNAPSHOT_REQUEST_ROUTING_KEY, request.message_id, request.payload);
      await client.query(
        `UPDATE load_customer_booking_snapshot_outbox
         SET state = 'published', published_at = now()
         WHERE message_id = $1`,
        [request.message_id]
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getUsableOrRequestReconciliation(customerId: string): Promise<CustomerBookingFactLookup> {
    if (!CUSTOMER_ID_PATTERN.test(customerId)) {
      throw new TypeError('Customer booking fact lookups require a UUIDv7 Customer ID.');
    }

    const lookup = await this.pool.query<ProjectionLookupRow>(
      `SELECT state.initialized, state.contiguous_registry_sequence,
              state.observed_registry_sequence, state.last_watermark_sequence,
              state.last_watermark_at, state.stream_stale, state.reconciliation_sequence,
              fact.customer_id, fact.result, fact.status, fact.legal_name, fact.owner_revision,
              fact.registry_sequence, fact.stale, fact.observed_owner_revision
       FROM load_customer_booking_projection_state AS state
       LEFT JOIN load_customer_booking_facts AS fact ON fact.customer_id = $2
       WHERE state.stream_key = $1`,
      [STREAM_KEY, customerId]
    );
    const lookupRow = lookup.rows[0];
    if (!lookupRow) {
      throw new Error('Load Customer booking projection migration has not been applied.');
    }
    const lookupFact = readLookupFact(lookupRow);
    if (lookupFact) {
      const fact = lookupFact;
      const state = readProjectionState(lookupRow, [fact]);
      const now = Date.now();
      if (customerBookingFactIsUsable(state, customerId, now)) {
        return { available: true, fact: resultFromFact(fact) };
      }
    }

    return this.withLockedProjection<CustomerBookingFactLookup>(async (_client, state) => {
      const now = Date.now();
      const expired = expireCustomerBookingWatermark(state, now);
      let nextState = expired.state;
      const requests = [...expired.snapshotRequests];
      const fact = nextState.facts[customerId];

      if (fact && customerBookingFactIsUsable(nextState, customerId, now)) {
        return {
          value: { available: true, fact: resultFromFact(fact) },
          state: nextState,
          snapshotRequests: requests,
        };
      }

      const lastAppliedOwnerRevision = fact?.result === 'FOUND' ? fact.ownerRevision : 0;
      requests.push({
        customerId,
        lastAppliedOwnerRevision,
        minimumRegistrySequence: Math.max(
          nextState.contiguousRegistrySequence,
          nextState.reconciliationSequence ?? 0,
          nextState.observedRegistrySequence
        ),
        ...(fact && fact.observedOwnerRevision > 0
          ? { observedOwnerRevision: fact.observedOwnerRevision }
          : {}),
        reason: !fact ? 'MISSING' : nextState.streamStale ? 'STREAM_GAP' : 'STALE',
      });
      return {
        value: { available: false },
        state: nextState,
        snapshotRequests: requests,
      };
    });
  }

  private async withLockedProjection<T>(
    operation: (
      client: PoolClient,
      state: CustomerBookingProjectionState
    ) => Promise<TransactionResult<T>>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const stateResult = await client.query<ProjectionStateRow>(
        `SELECT initialized, contiguous_registry_sequence, observed_registry_sequence,
                last_watermark_sequence, last_watermark_at, stream_stale, reconciliation_sequence
         FROM load_customer_booking_projection_state
         WHERE stream_key = $1
         FOR UPDATE`,
        [STREAM_KEY]
      );
      const stateRow = stateResult.rows[0];
      if (!stateRow) {
        throw new Error('Load Customer booking projection migration has not been applied.');
      }
      const factsResult = await client.query<ProjectionFactRow>(
        `SELECT customer_id, result, status, legal_name, owner_revision, registry_sequence,
                stale, observed_owner_revision
         FROM load_customer_booking_facts`
      );
      const state = readProjectionState(stateRow, factsResult.rows.map(readFact));
      const result = await operation(client, state);
      await this.persistProjection(client, state, result.state, result.snapshotRequests);
      await client.query('COMMIT');
      return result.value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async persistProjection(
    client: PoolClient,
    previousState: CustomerBookingProjectionState,
    state: CustomerBookingProjectionState,
    requests: CustomerBookingSnapshotRequest[]
  ): Promise<void> {
    if (
      state.initialized !== previousState.initialized ||
      state.contiguousRegistrySequence !== previousState.contiguousRegistrySequence ||
      state.observedRegistrySequence !== previousState.observedRegistrySequence ||
      state.lastWatermarkSequence !== previousState.lastWatermarkSequence ||
      state.lastWatermarkAt !== previousState.lastWatermarkAt ||
      state.streamStale !== previousState.streamStale ||
      state.reconciliationSequence !== previousState.reconciliationSequence
    ) {
      await client.query(
        `UPDATE load_customer_booking_projection_state
         SET initialized = $2,
             contiguous_registry_sequence = $3,
             observed_registry_sequence = $4,
             last_watermark_sequence = $5,
             last_watermark_at = $6,
             stream_stale = $7,
             reconciliation_sequence = $8,
             updated_at = now()
         WHERE stream_key = $1`,
        [
          STREAM_KEY,
          state.initialized,
          state.contiguousRegistrySequence,
          state.observedRegistrySequence,
          state.lastWatermarkSequence,
          state.lastWatermarkAt === null ? null : new Date(state.lastWatermarkAt),
          state.streamStale,
          state.reconciliationSequence,
        ]
      );
    }

    for (const fact of Object.values(state.facts)) {
      if (JSON.stringify(fact) === JSON.stringify(previousState.facts[fact.customerId])) {
        continue;
      }
      await client.query(
        `INSERT INTO load_customer_booking_facts
           (customer_id, result, status, legal_name, owner_revision, registry_sequence,
            stale, observed_owner_revision)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (customer_id) DO UPDATE
         SET result = EXCLUDED.result,
             status = EXCLUDED.status,
             legal_name = EXCLUDED.legal_name,
             owner_revision = EXCLUDED.owner_revision,
             registry_sequence = EXCLUDED.registry_sequence,
             stale = EXCLUDED.stale,
             observed_owner_revision = EXCLUDED.observed_owner_revision,
             updated_at = now()`,
        [
          fact.customerId,
          fact.result,
          fact.result === 'FOUND' ? fact.status : null,
          fact.result === 'FOUND' ? fact.legalName : null,
          fact.result === 'FOUND' ? fact.ownerRevision : 0,
          fact.registrySequence,
          fact.stale,
          fact.observedOwnerRevision,
        ]
      );
    }

    for (const request of requests) {
      const messageId = randomUUIDv7();
      const payload = {
        messageId,
        messageType: 'counterparty.customer.booking-fact.snapshot.get',
        schemaVersion: '1.0.0',
        sourceService: 'load',
        targetService: 'counterparty-registry',
        issuedAt: new Date().toISOString(),
        correlationId: messageId,
        payload: {
          customerId: request.customerId,
          lastAppliedOwnerRevision: request.lastAppliedOwnerRevision,
          minimumRegistrySequence: request.minimumRegistrySequence,
          ...(request.observedOwnerRevision === undefined
            ? {}
            : { observedOwnerRevision: request.observedOwnerRevision }),
          reason: request.reason,
        },
      };
      await client.query(
        `INSERT INTO load_customer_booking_snapshot_outbox
           (message_id, customer_id, reason, last_applied_owner_revision,
            minimum_registry_sequence, observed_owner_revision, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [
          messageId,
          request.customerId,
          request.reason,
          request.lastAppliedOwnerRevision,
          request.minimumRegistrySequence,
          request.observedOwnerRevision ?? null,
          JSON.stringify(payload),
        ]
      );
    }
  }
}
