import { createHash, randomUUIDv7 } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  CounterpartyRegistryRepository,
  CustomerBookingFactChanged,
  CustomerBookingSnapshotRequest,
  CustomerBookingSnapshotResult,
  DurableCustomerMessagePublisher,
  RecordCustomerBookingFactCommand,
} from '../../application/ports/counterparty-registry-repository';

const STREAM_KEY = 'customer-booking-facts-v1';
const FACT_ROUTING_KEY = 'counterparty.customer.booking-fact.changed.v1';
const WATERMARK_ROUTING_KEY = 'counterparty.customer.booking-fact.watermark.v1';
const SNAPSHOT_RESULT_ROUTING_KEY = 'counterparty.customer.booking-fact.snapshot.result.v1';

type CustomerOwnerRow = QueryResultRow & {
  counterparty_id: string;
  status: string;
  customer_owner_revision: string;
  legal_name: string;
};

type OutboxMessageRow = QueryResultRow & {
  message_id: string;
  routing_key: string;
  payload: unknown;
};

function safeNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new RangeError(
      `Registry sequence or owner revision "${value}" is outside the safe range.`
    );
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

function messageHash(message: CustomerBookingSnapshotRequest): Buffer {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(message)))
    .digest();
}

export class PostgresCounterpartyRegistryRepository implements CounterpartyRegistryRepository {
  constructor(private readonly pool: Pool) {}

  async recordCustomerBookingFact(
    command: RecordCustomerBookingFactCommand
  ): Promise<CustomerBookingFactChanged | null> {
    return this.withTransaction(async (client) => {
      await this.lockRegistryStream(client);
      const counterpartyResult = await client.query<{
        legal_name: string;
        owner_revision: string;
      }>(
        `SELECT legal_name, owner_revision
         FROM counterparties
         WHERE counterparty_id = $1
         FOR UPDATE`,
        [command.counterpartyId]
      );
      const counterparty = counterpartyResult.rows[0];
      const legalNameChanged = !counterparty || counterparty.legal_name !== command.legalName;
      if (!counterparty) {
        await client.query(
          `INSERT INTO counterparties
             (counterparty_id, legal_name, owner_revision, created_at, updated_at)
           VALUES ($1, $2, 1, now(), now())`,
          [command.counterpartyId, command.legalName]
        );
      } else if (counterparty.legal_name !== command.legalName) {
        await client.query(
          `UPDATE counterparties
           SET legal_name = $2, owner_revision = owner_revision + 1, updated_at = now()
           WHERE counterparty_id = $1`,
          [command.counterpartyId, command.legalName]
        );
      }

      const ownerResult = await client.query<CustomerOwnerRow>(
        `SELECT profile.counterparty_id,
                profile.status,
                profile.owner_revision AS customer_owner_revision,
                counterparty.legal_name
         FROM customer_profiles AS profile
         JOIN counterparties AS counterparty
           ON counterparty.counterparty_id = profile.counterparty_id
         WHERE profile.customer_id = $1
         FOR UPDATE OF profile, counterparty`,
        [command.customerId]
      );
      const owner = ownerResult.rows[0];
      if (owner && command.counterpartyId !== owner.counterparty_id) {
        throw new Error('A Customer profile cannot be reassigned to a different Counterparty.');
      }

      const statusChanged = !owner || owner.status !== command.status;
      if (owner && !legalNameChanged && !statusChanged) {
        return null;
      }

      const ownerRevision = owner ? safeNumber(owner.customer_owner_revision) + 1 : 1;
      if (!Number.isSafeInteger(ownerRevision)) {
        throw new RangeError('Customer owner revision exceeds the supported safe integer range.');
      }

      if (owner) {
        await client.query(
          `UPDATE customer_profiles
           SET status = $2, owner_revision = $3, updated_at = now()
           WHERE customer_id = $1`,
          [command.customerId, command.status, ownerRevision]
        );
      } else {
        await client.query(
          `INSERT INTO customer_profiles
             (customer_id, counterparty_id, status, owner_revision, created_at, updated_at)
           VALUES ($1, $2, $3, 1, now(), now())`,
          [command.customerId, command.counterpartyId, command.status]
        );
      }

      if (statusChanged) {
        const transitionSequence = await client.query<{ next_sequence: string }>(
          `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence
           FROM customer_profile_transitions
           WHERE customer_id = $1`,
          [command.customerId]
        );
        const occurredAt = new Date();
        await client.query(
          `INSERT INTO customer_profile_transitions
             (transition_id, customer_id, sequence_number, from_status, to_status,
              actor_principal_id, reason, occurred_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            randomUUIDv7(),
            command.customerId,
            transitionSequence.rows[0]?.next_sequence,
            owner?.status ?? null,
            command.status,
            command.actorPrincipalId,
            command.reason,
            occurredAt,
          ]
        );
      }

      const registrySequenceResult = await client.query<{ sequence: string }>(
        `UPDATE counterparty_registry_stream_state
         SET last_committed_registry_sequence = last_committed_registry_sequence + 1,
             updated_at = now()
         WHERE stream_key = $1
         RETURNING last_committed_registry_sequence AS sequence`,
        [STREAM_KEY]
      );
      const registrySequenceValue = registrySequenceResult.rows[0]?.sequence;
      if (!registrySequenceValue) {
        throw new Error('Counterparty Registry stream state has not been migrated.');
      }
      const registrySequence = safeNumber(registrySequenceValue);
      const messageId = randomUUIDv7();
      const occurredAt = new Date().toISOString();
      const event: CustomerBookingFactChanged = {
        messageId,
        messageType: 'counterparty.customer.booking-fact.changed',
        schemaVersion: '1.0.0',
        sourceService: 'counterparty-registry',
        targetService: 'load',
        occurredAt,
        correlationId: command.correlationId ?? messageId,
        ownerRevision,
        registrySequence,
        payload: {
          customerId: command.customerId,
          status: command.status,
          legalName: command.legalName,
        },
      };
      await client.query(
        `INSERT INTO counterparty_registry_outbox
           (message_id, message_kind, registry_sequence, routing_key, payload)
         VALUES ($1, 'CUSTOMER_BOOKING_FACT', $2, $3, $4)`,
        [messageId, registrySequence, FACT_ROUTING_KEY, JSON.stringify(event)]
      );
      return event;
    });
  }

  async answerCustomerBookingFactSnapshot(
    request: CustomerBookingSnapshotRequest
  ): Promise<'queued' | 'duplicate' | 'quarantined'> {
    const hash = messageHash(request);
    return this.withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO customer_booking_snapshot_inbox (message_id, content_hash)
         VALUES ($1, $2)
         ON CONFLICT (message_id) DO NOTHING
         RETURNING message_id`,
        [request.messageId, hash]
      );
      if (inserted.rowCount === 0) {
        const prior = await client.query<{ content_hash: Buffer }>(
          `SELECT content_hash FROM customer_booking_snapshot_inbox WHERE message_id = $1`,
          [request.messageId]
        );
        const originalHash = prior.rows[0]?.content_hash;
        if (!originalHash) {
          throw new Error('Snapshot inbox conflict occurred without a stored message hash.');
        }
        if (originalHash.equals(hash)) {
          return 'duplicate';
        }
        await client.query(
          `INSERT INTO customer_booking_snapshot_quarantine
             (message_id, original_content_hash, conflicting_content_hash, reason)
           VALUES ($1, $2, $3, 'MESSAGE_ID_CONTENT_CONFLICT')`,
          [request.messageId, originalHash, hash]
        );
        return 'quarantined';
      }

      const ownerResult = await client.query<{
        registry_sequence: string;
        customer_id: string | null;
        status: string | null;
        legal_name: string | null;
        owner_revision: string | null;
      }>(
        `SELECT stream.last_committed_registry_sequence AS registry_sequence,
                profile.customer_id,
                profile.status,
                counterparty.legal_name,
                profile.owner_revision
         FROM counterparty_registry_stream_state AS stream
         LEFT JOIN customer_profiles AS profile
           ON profile.customer_id = $2
         LEFT JOIN counterparties AS counterparty
           ON counterparty.counterparty_id = profile.counterparty_id
         WHERE stream.stream_key = $1`,
        [STREAM_KEY, request.payload.customerId]
      );
      const owner = ownerResult.rows[0];
      if (!owner) {
        throw new Error('Counterparty Registry stream state has not been migrated.');
      }
      const registrySequence = safeNumber(owner.registry_sequence);
      if (registrySequence < request.payload.minimumRegistrySequence) {
        throw new Error(
          `Snapshot requires Registry sequence ${request.payload.minimumRegistrySequence}, current sequence is ${registrySequence}.`
        );
      }

      const messageId = randomUUIDv7();
      const occurredAt = new Date().toISOString();
      let payload: CustomerBookingSnapshotResult['payload'];
      if (owner.customer_id === null) {
        payload = {
          customerId: request.payload.customerId,
          result: 'NOT_FOUND',
          registrySequence,
        };
      } else {
        if (owner.status === null || owner.legal_name === null || owner.owner_revision === null) {
          throw new Error('Counterparty Registry returned an incomplete Customer owner snapshot.');
        }
        const ownerRevision = safeNumber(owner.owner_revision);
        const minimumOwnerRevision = Math.max(
          request.payload.lastAppliedOwnerRevision,
          request.payload.observedOwnerRevision ?? 0
        );
        if (ownerRevision < minimumOwnerRevision) {
          throw new Error(
            `Snapshot owner revision ${ownerRevision} is below required revision ${minimumOwnerRevision}.`
          );
        }
        payload = {
          customerId: request.payload.customerId,
          result: 'FOUND',
          status: owner.status as 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED',
          legalName: owner.legal_name,
          ownerRevision,
          registrySequence,
        };
      }
      const result: CustomerBookingSnapshotResult = {
        messageId,
        messageType: 'counterparty.customer.booking-fact.snapshot.result',
        schemaVersion: '1.0.0',
        sourceService: 'counterparty-registry',
        targetService: 'load',
        occurredAt,
        correlationId: request.correlationId,
        causationId: request.messageId,
        ...(payload.result === 'FOUND' ? { ownerRevision: payload.ownerRevision } : {}),
        payload,
      };
      await client.query(
        `INSERT INTO counterparty_registry_outbox
           (message_id, message_kind, routing_key, payload)
         VALUES ($1, 'CUSTOMER_BOOKING_SNAPSHOT', $2, $3)`,
        [messageId, SNAPSHOT_RESULT_ROUTING_KEY, JSON.stringify(result)]
      );
      return 'queued';
    });
  }

  async enqueueCompletenessWatermarkIfDue(now = new Date()): Promise<boolean> {
    return this.withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(514, 1)');
      const streamResult = await client.query<{ sequence: string }>(
        `SELECT last_committed_registry_sequence AS sequence
         FROM counterparty_registry_stream_state
         WHERE stream_key = $1
         FOR UPDATE`,
        [STREAM_KEY]
      );
      const currentSequence = streamResult.rows[0]?.sequence;
      if (currentSequence === undefined) {
        throw new Error('Counterparty Registry stream state has not been migrated.');
      }
      const highWatermarkSequence = safeNumber(currentSequence);
      const existing = await client.query<{ state: string; published_at: Date | null }>(
        `SELECT state, published_at
         FROM counterparty_registry_outbox
         WHERE message_kind = 'CUSTOMER_BOOKING_WATERMARK'
         ORDER BY outbox_id DESC
         LIMIT 1`
      );
      if (existing.rows[0]?.state === 'pending') {
        return false;
      }
      const latestPublishedAt = existing.rows[0]?.published_at;
      if (latestPublishedAt && now.getTime() - latestPublishedAt.getTime() < 10_000) {
        return false;
      }
      const unconfirmedFacts = await client.query(
        `SELECT 1
         FROM counterparty_registry_outbox
         WHERE message_kind = 'CUSTOMER_BOOKING_FACT'
           AND registry_sequence <= $1
           AND state <> 'published'
         LIMIT 1`,
        [highWatermarkSequence]
      );
      if (unconfirmedFacts.rowCount !== 0) {
        return false;
      }

      const messageId = randomUUIDv7();
      const watermark = {
        messageId,
        messageType: 'counterparty.customer.booking-fact.watermark',
        schemaVersion: '1.0.0',
        sourceService: 'counterparty-registry',
        targetService: 'load',
        occurredAt: now.toISOString(),
        correlationId: messageId,
        payload: { highWatermarkSequence },
      };
      await client.query(
        `INSERT INTO counterparty_registry_outbox
           (message_id, message_kind, routing_key, payload)
         VALUES ($1, 'CUSTOMER_BOOKING_WATERMARK', $2, $3)`,
        [messageId, WATERMARK_ROUTING_KEY, JSON.stringify(watermark)]
      );
      return true;
    });
  }

  async publishNextOutboxMessage(publisher: DurableCustomerMessagePublisher): Promise<boolean> {
    return this.withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(514, 1)');
      const result = await client.query<OutboxMessageRow>(
        `SELECT message_id, routing_key, payload
         FROM counterparty_registry_outbox
         WHERE state = 'pending'
         ORDER BY outbox_id
         LIMIT 1
         FOR UPDATE`
      );
      const message = result.rows[0];
      if (!message) {
        return false;
      }

      // Holding the outbox lock through broker confirmation preserves commit order.
      await publisher.publish(message.routing_key, message.message_id, message.payload);
      await client.query(
        `UPDATE counterparty_registry_outbox
         SET state = 'published', published_at = now()
         WHERE message_id = $1`,
        [message.message_id]
      );
      return true;
    });
  }

  private async lockRegistryStream(client: PoolClient): Promise<void> {
    const stream = await client.query(
      `SELECT stream_key
       FROM counterparty_registry_stream_state
       WHERE stream_key = $1
       FOR UPDATE`,
      [STREAM_KEY]
    );
    if (stream.rowCount !== 1) {
      throw new Error('Counterparty Registry stream state has not been migrated.');
    }
  }

  private async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
