import { createHash, randomUUIDv7 } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  BookingSubmissionReadResult,
  LoadReadRepository,
  LoadReadResult,
} from '../../application/ports/load-read-repository';
import { IdempotencyConflictError } from '../../application/commands/submit-booking';
import { evaluateBookingSubmission } from '../../domain/booking/booking-evaluation';
import type {
  BookingFollowUp,
  NormalizedBookingRow,
} from '../../domain/booking/booking-evaluation';
import type { BookingSubmissionAccess } from '../../domain/authorization/load-access-policy';
import type {
  CustomerBookingFactResult,
  LoadBookingOutboxRepository,
  LoadBookingSubmissionRepository,
  LoadBookingSubmissionRequest,
  LoadBookingSubmissionResult,
  LoadOutboxPublisher,
} from '../../application/ports/load-booking-ports';
import type { IdentityTokenClaims } from '@app/identity-token';

const LOAD_BOOKED_ROUTING_KEY = 'load.booked.v1';

type SubmissionRow = QueryResultRow & {
  submission_id: string;
  initiating_principal_id: string;
  normalized_content_hash: Buffer;
  correction_of_submission_id: string | null;
  outcome: 'accepted' | 'rejected';
  normalized_input: unknown;
  result_snapshot: unknown;
  created_at: Date;
};

type LoadReadRow = QueryResultRow & {
  load_id: string;
  load_reference: string;
  area_id: string;
  handling_broker_principal_id: string;
  lifecycle_status: string;
  revision_id: string;
  revision_number: number;
  created_at: Date;
  customer_id: string;
  customer_name_snapshot: string;
  customer_reference: string | null;
  customer_rate_amount: string;
  customer_rate_currency: string;
  equipment_profile: string | null;
  total_gross_weight_value: string | null;
  total_gross_weight_unit: string | null;
  temperature_minimum: string | null;
  temperature_maximum: string | null;
  temperature_unit: string | null;
  reefer_mode: string | null;
  tarp_required: boolean | null;
};

const INPUT_SCHEMA_VERSION = '1.0.0';
const RESULT_SCHEMA_VERSION = '1.0.0';
const BOOKING_FIELD_KEYS = new Set([
  'areaId',
  'customerId',
  'customerReference',
  'customerRate',
  'amount',
  'currency',
  'equipmentProfile',
  'specialHandlingCodes',
  'totalGrossWeight',
  'value',
  'unit',
  'temperatureRange',
  'minimum',
  'maximum',
  'reeferMode',
  'tarpRequired',
  'stops',
  'type',
  'address',
  'addressLine1',
  'addressLine2',
  'city',
  'stateCode',
  'postalCode',
  'countryCode',
  'coordinates',
  'latitude',
  'longitude',
  'appointmentWindow',
  'startAt',
  'endAt',
  'timeZone',
  'facilityName',
  'contactName',
  'contactPhone',
  'accessInstructions',
  'freightLines',
  'description',
  'quantity',
  'handlingUnitCode',
  'handlingUnitDescription',
  'stackable',
  'dimensions',
  'length',
  'width',
  'height',
]);

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

function canonicalizeRejectedInput(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalizeRejectedInput(item, key));
    return key === 'specialHandlingCodes'
      ? [...new Set(items.map((item) => (typeof item === 'string' ? item.toUpperCase() : item)))]
      : items;
  }
  if (!isRecord(value)) {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    if (
      [
        'type',
        'stateCode',
        'countryCode',
        'currency',
        'unit',
        'handlingUnitCode',
        'equipmentProfile',
        'reeferMode',
      ].includes(key)
    ) {
      return trimmed.toUpperCase();
    }
    if (key === 'customerId') {
      return trimmed.toLowerCase();
    }
    const decimalScales: Record<string, number> = {
      amount: 2,
      value: 3,
      minimum: 2,
      maximum: 2,
      length: 2,
      width: 2,
      height: 2,
    };
    const scale = decimalScales[key];
    if (scale !== undefined) {
      const signed = key === 'minimum' || key === 'maximum';
      const pattern = signed
        ? new RegExp(`^(-?)(\\d+)(?:\\.(\\d{1,${scale}}))?$`)
        : new RegExp(`^(\\d+)(?:\\.(\\d{1,${scale}}))?$`);
      const match = pattern.exec(trimmed);
      if (match) {
        const negative = signed ? match[1] === '-' : false;
        const whole = (signed ? match[2] : match[1])!.replace(/^0+(?=\d)/, '');
        const fraction = (signed ? match[3] : match[2]) ?? '';
        const normalizedFraction = fraction.padEnd(scale, '0');
        const zero = BigInt(whole) === 0n && BigInt(normalizedFraction || '0') === 0n;
        return `${negative && !zero ? '-' : ''}${whole}.${normalizedFraction}`;
      }
    }
    if (key === 'quantity' && /^\d+$/.test(trimmed)) {
      const withoutLeadingZeroes = trimmed.replace(/^0+(?=\d)/, '');
      return withoutLeadingZeroes.length <= 12 ? withoutLeadingZeroes : trimmed;
    }
    return trimmed;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([childKey, item]) => {
        if (item === null) {
          return [];
        }
        const normalized = canonicalizeRejectedInput(item, childKey);
        return normalized === '' && BOOKING_FIELD_KEYS.has(childKey)
          ? []
          : [[childKey, normalized]];
      })
  );
}

function omitEmptyCanonicalFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(omitEmptyCanonicalFields);
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, item]) =>
          item !== null &&
          !(key === 'specialHandlingCodes' && Array.isArray(item) && item.length === 0)
      )
      .map(([key, item]) => [key, omitEmptyCanonicalFields(item)])
  );
}

function normalizedRequest(request: LoadBookingSubmissionRequest) {
  const customerFacts: Record<string, CustomerBookingFactResult> = {};
  for (const row of request.rows) {
    if (isRecord(row) && typeof row.customerId === 'string') {
      const customerId = row.customerId.trim();
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(customerId)
      ) {
        customerFacts[customerId.toLowerCase()] = {
          result: 'FOUND',
          status: 'ACTIVE',
          legalName: 'Idempotency Normalization',
          ownerRevision: 1,
          registrySequence: 1,
        };
      }
    }
  }
  const evaluation = evaluateBookingSubmission(request.rows, customerFacts);
  const isAcceptedShape = evaluation.issues.length === 0;
  const rows = isAcceptedShape
    ? evaluation.normalizedRows.map((row) => {
        if (!row) {
          return null;
        }
        return omitEmptyCanonicalFields(
          Object.fromEntries(
            Object.entries(row).filter(([field]) => field !== 'customerNameSnapshot')
          )
        );
      })
    : canonicalizeRejectedInput(request.rows);
  return canonicalize({
    rows,
    ...(isAcceptedShape
      ? {
          followUpItems: evaluation.followUpItems.map(({ rowNumber, fieldPath, code }) => ({
            rowNumber,
            fieldPath,
            code,
          })),
        }
      : {}),
    areaAssertions: request.rows.map((row) =>
      isRecord(row) ? canonicalizeRejectedInput(row.areaId, 'areaId') : null
    ),
    correctionOfSubmissionId: request.correctionOfSubmissionId?.toLowerCase() ?? null,
  });
}

function contentHash(request: LoadBookingSubmissionRequest): Buffer {
  return createHash('sha256')
    .update(JSON.stringify(normalizedRequest(request)))
    .digest();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function snapshotValue(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Persisted booking submission result is not an object.');
  }
  return value;
}

function asResult(row: SubmissionRow, replayed: boolean): LoadBookingSubmissionResult {
  return {
    submissionId: row.submission_id,
    replayed,
    representation: snapshotValue(row.result_snapshot),
  };
}

function throwIfDifferentContent(row: SubmissionRow, hash: Buffer): void {
  if (!row.normalized_content_hash.equals(hash)) {
    throw new IdempotencyConflictError();
  }
}

function canonicalUtcTimestamp(value: string): string {
  return value.replace(/(\.\d*?[1-9])0+Z$/, '$1Z').replace(/\.0+Z$/, 'Z');
}

function revisionPayload(
  row: LoadReadRow,
  stops: unknown[],
  freightLines: unknown[],
  specialHandlingCodes: string[]
) {
  return {
    revisionId: row.revision_id,
    revisionNumber: row.revision_number,
    createdAt: row.created_at.toISOString(),
    customerId: row.customer_id,
    customerNameSnapshot: row.customer_name_snapshot,
    ...(row.customer_reference ? { customerReference: row.customer_reference } : {}),
    customerRate: {
      amount: row.customer_rate_amount,
      currency: row.customer_rate_currency,
    },
    ...(row.equipment_profile ? { equipmentProfile: row.equipment_profile } : {}),
    ...(row.total_gross_weight_value !== null
      ? {
          totalGrossWeight: {
            value: row.total_gross_weight_value,
            unit: row.total_gross_weight_unit,
          },
        }
      : {}),
    ...(row.temperature_minimum !== null
      ? {
          temperatureRange: {
            minimum: row.temperature_minimum,
            maximum: row.temperature_maximum,
            unit: row.temperature_unit,
          },
        }
      : {}),
    ...(row.reefer_mode ? { reeferMode: row.reefer_mode } : {}),
    ...(row.tarp_required !== null ? { tarpRequired: row.tarp_required } : {}),
    ...(specialHandlingCodes.length > 0 ? { specialHandlingCodes } : {}),
    stops,
    freightLines,
  };
}

export class PostgresLoadBookingRepository
  implements LoadBookingSubmissionRepository, LoadBookingOutboxRepository, LoadReadRepository
{
  constructor(private readonly pool: Pool) {}

  async publishNextOutboxMessage(publisher: LoadOutboxPublisher): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(515, 1)');
      const result = await client.query<{
        message_id: string;
        message_type: string;
        payload: unknown;
      }>(
        `SELECT message_id, message_type, payload
         FROM load_outbox
         WHERE state = 'pending'
           AND NOT EXISTS (
             SELECT 1
             FROM load_outbox earlier
             WHERE earlier.load_id = load_outbox.load_id
               AND earlier.owner_revision < load_outbox.owner_revision
               AND earlier.state = 'pending'
           )
         ORDER BY created_at, message_id
         LIMIT 1
         FOR UPDATE`
      );
      const message = result.rows[0];
      if (!message) {
        await client.query('COMMIT');
        return false;
      }

      const routingKey = this.outboxRoutingKey(message.message_type);
      await publisher.publish(routingKey, message.message_id, message.payload);
      await client.query(
        `UPDATE load_outbox
         SET state = 'published', published_at = now()
         WHERE message_id = $1`,
        [message.message_id]
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

  async findSubmission(submissionId: string): Promise<BookingSubmissionAccess | null> {
    const result = await this.pool.query<{
      initiating_principal_id: string;
      outcome: 'accepted' | 'rejected';
    }>(
      `SELECT initiating_principal_id, outcome
       FROM booking_submissions
       WHERE submission_id = $1`,
      [submissionId]
    );
    const submission = result.rows[0];
    if (!submission) {
      return null;
    }
    const areas = await this.pool.query<{ area_id: string }>(
      `SELECT area_id
       FROM booking_submission_areas
       WHERE submission_id = $1
       ORDER BY source_row_number`,
      [submissionId]
    );
    return {
      creatorPrincipalId: submission.initiating_principal_id,
      outcome: submission.outcome,
      loadAreas: areas.rows.map(({ area_id }) => area_id),
    };
  }

  async findIdempotentSubmission(
    identity: IdentityTokenClaims,
    request: LoadBookingSubmissionRequest
  ): Promise<{
    result: LoadBookingSubmissionResult;
    authorization: BookingSubmissionAccess;
  } | null> {
    const result = await this.pool.query<SubmissionRow>(
      `SELECT submission_id, initiating_principal_id, normalized_content_hash,
              correction_of_submission_id, outcome, normalized_input,
              result_snapshot, created_at
       FROM booking_submissions
       WHERE initiating_principal_id = $1 AND idempotency_key = $2`,
      [identity.sub, request.idempotencyKey]
    );
    const existing = result.rows[0];
    if (!existing) {
      return null;
    }
    throwIfDifferentContent(existing, contentHash(request));
    const authorization = await this.findSubmission(existing.submission_id);
    if (!authorization) {
      throw new Error('Idempotent booking record disappeared during authorization lookup.');
    }
    return { result: asResult(existing, true), authorization };
  }

  async createSubmission(
    identity: IdentityTokenClaims,
    request: LoadBookingSubmissionRequest,
    areaIds: string[],
    areaMappingRevisions: string[],
    customerFacts: Record<string, CustomerBookingFactResult>
  ): Promise<LoadBookingSubmissionResult> {
    if (
      areaIds.length !== request.rows.length ||
      areaMappingRevisions.length !== request.rows.length
    ) {
      throw new Error('The derived booking geography does not match the submitted rows.');
    }

    const client = await this.pool.connect();
    const hash = contentHash(request);
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `${identity.sub}:${request.idempotencyKey}`,
      ]);
      const prior = await this.findExisting(client, identity.sub, request.idempotencyKey);
      if (prior) {
        throwIfDifferentContent(prior, hash);
        await client.query('COMMIT');
        return asResult(prior, true);
      }

      if (request.correctionOfSubmissionId) {
        const correction = await client.query<{
          initiating_principal_id: string;
          outcome: 'accepted' | 'rejected';
        }>(
          `SELECT initiating_principal_id, outcome
           FROM booking_submissions
           WHERE submission_id = $1
           FOR SHARE`,
          [request.correctionOfSubmissionId]
        );
        const original = correction.rows[0];
        if (
          !original ||
          original.outcome !== 'rejected' ||
          original.initiating_principal_id !== identity.sub
        ) {
          throw new Error('The correction target must be a rejected submission created by caller.');
        }
      }

      const evaluation = evaluateBookingSubmission(request.rows, customerFacts);
      const submissionId = randomUUIDv7();
      const normalizedInput = normalizedRequest(request);
      const correctionOfSubmissionId = request.correctionOfSubmissionId?.toLowerCase() ?? null;
      const createdAt = new Date().toISOString();
      if (evaluation.issues.length > 0) {
        const representation = {
          submissionId,
          outcome: 'rejected',
          createdAt,
          correctionOfSubmissionId,
          loadReferences: [],
          issues: evaluation.issues,
          followUpItems: [],
        };
        const inserted = await this.insertSubmission(
          client,
          identity.sub,
          request,
          hash,
          submissionId,
          'rejected',
          normalizedInput,
          representation
        );
        await this.insertSubmissionAreas(client, submissionId, areaIds);
        await client.query('COMMIT');
        return asResult(inserted, false);
      }

      const normalizedRows = evaluation.normalizedRows as NormalizedBookingRow[];
      const ids = normalizedRows.map(() => randomUUIDv7());
      const references = await Promise.all(
        ids.map(async () => {
          const next = await client.query<{ value: string }>(
            `SELECT nextval('load_reference_sequence')::text AS value`
          );
          return `LD-${next.rows[0]?.value}`;
        })
      );
      const loadReferences = ids.map((loadId, index) => ({
        rowNumber: index + 1,
        loadId,
        loadReference: references[index],
      }));
      const evaluatedFollowUps = evaluation.followUpItems.map((item: BookingFollowUp) => ({
        loadId: ids[item.rowNumber - 1]!,
        ...item,
      }));
      const representation = {
        submissionId,
        outcome: 'accepted',
        createdAt,
        correctionOfSubmissionId,
        loadReferences,
        issues: [],
        followUpItems: evaluatedFollowUps,
      };
      await this.insertSubmission(
        client,
        identity.sub,
        request,
        hash,
        submissionId,
        'accepted',
        normalizedInput,
        representation
      );
      await this.insertSubmissionAreas(client, submissionId, areaIds);

      for (const [index, row] of normalizedRows.entries()) {
        await this.insertLoad(client, {
          identity,
          request,
          submissionId,
          loadId: ids[index]!,
          loadReference: references[index]!,
          sourceRowNumber: index + 1,
          areaId: areaIds[index]!,
          areaMappingRevision: areaMappingRevisions[index]!,
          row,
        });
      }

      const stored = await this.findExisting(client, identity.sub, request.idempotencyKey);
      if (!stored) {
        throw new Error('Committed booking result could not be read before commit.');
      }
      await client.query('COMMIT');
      return asResult(stored, false);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findLoad(loadId: string): Promise<LoadReadResult | null> {
    const row = await this.findCurrentLoad(loadId);
    if (!row) {
      return null;
    }
    const [stops, freightLines] = await Promise.all([
      this.readStops(row.revision_id),
      this.readFreightLines(row.revision_id),
    ]);
    const specialHandlingCodes = await this.readSpecialHandlingCodes(row.revision_id);
    return {
      authorization: {
        areaId: row.area_id,
        handlingBrokerPrincipalId: row.handling_broker_principal_id,
      },
      representation: {
        loadId: row.load_id,
        loadReference: row.load_reference,
        areaId: row.area_id,
        lifecycleStatus: row.lifecycle_status,
        currentRevision: revisionPayload(row, stops, freightLines, specialHandlingCodes),
      },
    };
  }

  async findRevision(loadId: string, revisionId: string): Promise<LoadReadResult | null> {
    const result = await this.pool.query<LoadReadRow>(
      `SELECT load.load_id, load.load_reference, load.area_id,
              load.handling_broker_principal_id, load.lifecycle_status,
              revision.revision_id, revision.revision_number, revision.created_at,
              revision.customer_id, revision.customer_name_snapshot,
              revision.customer_reference, revision.customer_rate_amount::text,
              revision.customer_rate_currency, revision.equipment_profile,
              revision.total_gross_weight_value::text, revision.total_gross_weight_unit,
              revision.temperature_minimum::text, revision.temperature_maximum::text,
              revision.temperature_unit, revision.reefer_mode, revision.tarp_required
       FROM loads AS load
       JOIN load_revisions AS revision ON revision.load_id = load.load_id
       WHERE load.load_id = $1 AND revision.revision_id = $2
         AND revision.construction_state = 'COMMITTED'`,
      [loadId, revisionId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      authorization: {
        areaId: row.area_id,
        handlingBrokerPrincipalId: row.handling_broker_principal_id,
      },
      representation: revisionPayload(
        row,
        await this.readStops(row.revision_id),
        await this.readFreightLines(row.revision_id),
        await this.readSpecialHandlingCodes(row.revision_id)
      ),
    };
  }

  async findBookingSubmission(submissionId: string): Promise<BookingSubmissionReadResult | null> {
    const result = await this.pool.query<SubmissionRow>(
      `SELECT submission_id, initiating_principal_id, normalized_content_hash,
              correction_of_submission_id, outcome, normalized_input,
              result_snapshot, created_at
       FROM booking_submissions
       WHERE submission_id = $1`,
      [submissionId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    const authorization = await this.findSubmission(submissionId);
    if (!authorization) {
      throw new Error('Booking submission disappeared during authorization lookup.');
    }
    return { authorization, representation: snapshotValue(row.result_snapshot) };
  }

  private async findExisting(
    client: PoolClient,
    principalId: string,
    idempotencyKey: string
  ): Promise<SubmissionRow | null> {
    const result = await client.query<SubmissionRow>(
      `SELECT submission_id, initiating_principal_id, normalized_content_hash,
              correction_of_submission_id, outcome, normalized_input,
              result_snapshot, created_at
       FROM booking_submissions
       WHERE initiating_principal_id = $1 AND idempotency_key = $2`,
      [principalId, idempotencyKey]
    );
    return result.rows[0] ?? null;
  }

  private async insertSubmission(
    client: PoolClient,
    principalId: string,
    request: LoadBookingSubmissionRequest,
    hash: Buffer,
    submissionId: string,
    outcome: 'accepted' | 'rejected',
    normalizedInput: unknown,
    resultSnapshot: unknown
  ): Promise<SubmissionRow> {
    const inserted = await client.query<SubmissionRow>(
      `INSERT INTO booking_submissions (
         submission_id, initiating_principal_id, idempotency_key,
         normalized_content_hash, correction_of_submission_id, outcome,
         input_schema_version, normalized_input, result_schema_version,
         result_snapshot
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING submission_id, initiating_principal_id, normalized_content_hash,
                 correction_of_submission_id, outcome, normalized_input,
                 result_snapshot, created_at`,
      [
        submissionId,
        principalId,
        request.idempotencyKey,
        hash,
        request.correctionOfSubmissionId ?? null,
        outcome,
        INPUT_SCHEMA_VERSION,
        normalizedInput,
        RESULT_SCHEMA_VERSION,
        resultSnapshot,
      ]
    );
    const row = inserted.rows[0];
    if (!row) {
      throw new Error('Booking submission insert returned no row.');
    }
    return row;
  }

  private async insertSubmissionAreas(
    client: PoolClient,
    submissionId: string,
    areaIds: string[]
  ): Promise<void> {
    for (const [index, areaId] of areaIds.entries()) {
      await client.query(
        `INSERT INTO booking_submission_areas (submission_id, source_row_number, area_id)
         VALUES ($1, $2, $3)`,
        [submissionId, index + 1, areaId]
      );
    }
  }

  private async insertLoad(
    client: PoolClient,
    input: {
      identity: IdentityTokenClaims;
      request: LoadBookingSubmissionRequest;
      submissionId: string;
      loadId: string;
      loadReference: string;
      sourceRowNumber: number;
      areaId: string;
      areaMappingRevision: string;
      row: NormalizedBookingRow;
    }
  ): Promise<void> {
    const revisionId = randomUUIDv7();
    const messageId = randomUUIDv7();
    const revisionCreatedAt = new Date();
    const stopIds = input.row.stops.map(() => randomUUIDv7());
    const freightLineIds = input.row.freightLines.map(() => randomUUIDv7());
    await client.query(
      `INSERT INTO loads (
         load_id, load_reference, booking_submission_id, source_row_number,
         area_id, area_mapping_revision, handling_broker_principal_id,
         current_revision_id, lifecycle_status, owner_revision
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'BOOKED', 1)`,
      [
        input.loadId,
        input.loadReference,
        input.submissionId,
        input.sourceRowNumber,
        input.areaId,
        input.areaMappingRevision,
        input.identity.sub,
        revisionId,
      ]
    );
    await client.query(
      `INSERT INTO load_revisions (
         revision_id, load_id, revision_number, construction_state,
         customer_id, customer_name_snapshot, customer_reference,
         customer_rate_amount, customer_rate_currency, equipment_profile,
         total_gross_weight_value, total_gross_weight_unit,
         temperature_minimum, temperature_maximum, temperature_unit,
         reefer_mode, tarp_required, created_at
       ) VALUES ($1, $2, 1, 'BUILDING', $3, $4, $5, $6, 'USD', $7,
                 $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        revisionId,
        input.loadId,
        input.row.customerId,
        input.row.customerNameSnapshot,
        input.row.customerReference,
        input.row.customerRateAmount,
        input.row.equipmentProfile,
        input.row.totalGrossWeightValue,
        input.row.totalGrossWeightUnit,
        input.row.temperatureMinimum,
        input.row.temperatureMaximum,
        input.row.temperatureUnit,
        input.row.reeferMode,
        input.row.tarpRequired,
        revisionCreatedAt,
      ]
    );
    for (const [index, stop] of input.row.stops.entries()) {
      await client.query(
        `INSERT INTO load_revision_stops (
           stop_id, revision_id, sequence_number, stop_type, address_line1,
           address_line2, city, state_code, postal_code, country_code,
           latitude, longitude, appointment_start_at, appointment_end_at,
           time_zone, facility_name, contact_name, contact_phone, access_instructions
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                   $13, $14, $15, $16, $17, $18, $19)`,
        [
          stopIds[index]!,
          revisionId,
          index + 1,
          stop.stopType,
          stop.addressLine1,
          stop.addressLine2,
          stop.city,
          stop.stateCode,
          stop.postalCode,
          stop.countryCode,
          stop.latitude,
          stop.longitude,
          stop.appointmentStartAt,
          stop.appointmentEndAt,
          stop.timeZone,
          stop.facilityName,
          stop.contactName,
          stop.contactPhone,
          stop.accessInstructions,
        ]
      );
    }
    for (const [index, line] of input.row.freightLines.entries()) {
      await client.query(
        `INSERT INTO load_revision_freight_lines (
           freight_line_id, revision_id, sequence_number, description, quantity,
           handling_unit_code, handling_unit_description, stackable,
           length, width, height, dimension_unit
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          freightLineIds[index]!,
          revisionId,
          index + 1,
          line.description,
          line.quantity,
          line.handlingUnitCode,
          line.handlingUnitDescription,
          line.stackable,
          line.length,
          line.width,
          line.height,
          line.dimensionUnit,
        ]
      );
    }
    for (const [index, code] of input.row.specialHandlingCodes.entries()) {
      await client.query(
        `INSERT INTO load_revision_special_handling_codes (revision_id, sequence_number, code)
         VALUES ($1, $2, $3)`,
        [revisionId, index + 1, code]
      );
    }
    await client.query(
      `UPDATE load_revisions SET construction_state = 'COMMITTED' WHERE revision_id = $1`,
      [revisionId]
    );
    await client.query(
      `INSERT INTO load_lifecycle_transitions (
         transition_id, load_id, transition_number, from_status, to_status,
         reason_code, actor_principal_id, source, correlation_id
       ) VALUES ($1, $2, 1, NULL, 'BOOKED', 'BOOKING_ACCEPTED', $3, 'BOOKING', $4)`,
      [randomUUIDv7(), input.loadId, input.identity.sub, input.submissionId]
    );
    const loadRevision = {
      revisionId,
      revisionNumber: 1,
      createdAt: revisionCreatedAt.toISOString(),
      customerId: input.row.customerId,
      customerNameSnapshot: input.row.customerNameSnapshot,
      ...(input.row.customerReference ? { customerReference: input.row.customerReference } : {}),
      customerRate: {
        amount: input.row.customerRateAmount,
        currency: 'USD',
      },
      ...(input.row.equipmentProfile ? { equipmentProfile: input.row.equipmentProfile } : {}),
      ...(input.row.specialHandlingCodes.length > 0
        ? { specialHandlingCodes: input.row.specialHandlingCodes }
        : {}),
      ...(input.row.totalGrossWeightValue !== null
        ? {
            totalGrossWeight: {
              value: input.row.totalGrossWeightValue,
              unit: input.row.totalGrossWeightUnit,
            },
          }
        : {}),
      ...(input.row.temperatureMinimum !== null
        ? {
            temperatureRange: {
              minimum: input.row.temperatureMinimum,
              maximum: input.row.temperatureMaximum,
              unit: input.row.temperatureUnit,
            },
          }
        : {}),
      ...(input.row.reeferMode ? { reeferMode: input.row.reeferMode } : {}),
      ...(input.row.tarpRequired !== null ? { tarpRequired: input.row.tarpRequired } : {}),
      stops: input.row.stops.map((stop, index) => ({
        stopId: stopIds[index],
        sequenceNumber: index + 1,
        type: stop.stopType,
        address: {
          addressLine1: stop.addressLine1,
          ...(stop.addressLine2 ? { addressLine2: stop.addressLine2 } : {}),
          city: stop.city,
          stateCode: stop.stateCode,
          postalCode: stop.postalCode,
          countryCode: stop.countryCode,
          ...(stop.latitude !== null && stop.longitude !== null
            ? { coordinates: { latitude: stop.latitude, longitude: stop.longitude } }
            : {}),
        },
        appointmentWindow: {
          startAt: stop.appointmentStartAt,
          endAt: stop.appointmentEndAt,
          timeZone: stop.timeZone,
        },
        ...(stop.facilityName ? { facilityName: stop.facilityName } : {}),
        ...(stop.contactName ? { contactName: stop.contactName } : {}),
        ...(stop.contactPhone ? { contactPhone: stop.contactPhone } : {}),
        ...(stop.accessInstructions ? { accessInstructions: stop.accessInstructions } : {}),
      })),
      freightLines: input.row.freightLines.map((line, index) => ({
        freightLineId: freightLineIds[index],
        sequenceNumber: index + 1,
        description: line.description,
        quantity: line.quantity,
        handlingUnitCode: line.handlingUnitCode,
        ...(line.handlingUnitDescription
          ? { handlingUnitDescription: line.handlingUnitDescription }
          : {}),
        stackable: line.stackable,
        ...(line.length !== null &&
        line.width !== null &&
        line.height !== null &&
        line.dimensionUnit !== null
          ? {
              dimensions: {
                length: line.length,
                width: line.width,
                height: line.height,
                unit: line.dimensionUnit,
              },
            }
          : {}),
      })),
    };
    await client.query(
      `INSERT INTO load_outbox (message_id, load_id, owner_revision, message_type, payload)
       VALUES ($1, $2, 1, 'load.booked', $3)`,
      [
        messageId,
        input.loadId,
        {
          messageId,
          messageType: 'load.booked',
          schemaVersion: '1.0.0',
          sourceService: 'load',
          occurredAt: revisionCreatedAt.toISOString(),
          correlationId: input.submissionId,
          ownerRevision: 1,
          initiatingPrincipalId: input.identity.sub,
          payload: {
            loadId: input.loadId,
            loadReference: input.loadReference,
            bookingSubmissionId: input.submissionId,
            sourceRowNumber: input.sourceRowNumber,
            lifecycleStatus: 'BOOKED',
            loadRevision,
          },
        },
      ]
    );
  }

  private async findCurrentLoad(loadId: string): Promise<LoadReadRow | null> {
    const result = await this.pool.query<LoadReadRow>(
      `SELECT load.load_id, load.load_reference, load.area_id,
              load.handling_broker_principal_id, load.lifecycle_status,
              revision.revision_id, revision.revision_number, revision.created_at,
              revision.customer_id, revision.customer_name_snapshot,
              revision.customer_reference, revision.customer_rate_amount::text,
              revision.customer_rate_currency, revision.equipment_profile,
              revision.total_gross_weight_value::text, revision.total_gross_weight_unit,
              revision.temperature_minimum::text, revision.temperature_maximum::text,
              revision.temperature_unit, revision.reefer_mode, revision.tarp_required
       FROM loads AS load
       JOIN load_revisions AS revision
         ON revision.load_id = load.load_id AND revision.revision_id = load.current_revision_id
       WHERE load.load_id = $1 AND revision.construction_state = 'COMMITTED'`,
      [loadId]
    );
    return result.rows[0] ?? null;
  }

  private async readStops(revisionId: string): Promise<unknown[]> {
    const result = await this.pool.query<{
      stop_id: string;
      stop_type: 'PICKUP' | 'DELIVERY';
      sequence_number: number;
      address_line1: string;
      address_line2: string | null;
      city: string;
      state_code: string;
      postal_code: string;
      country_code: 'US';
      latitude: string | null;
      longitude: string | null;
      appointment_start_at: string;
      appointment_end_at: string;
      time_zone: string;
      facility_name: string | null;
      contact_name: string | null;
      contact_phone: string | null;
      access_instructions: string | null;
    }>(
      `SELECT stop_id, stop_type, sequence_number, address_line1, address_line2,
              city, state_code, postal_code, country_code, latitude, longitude,
              to_char(appointment_start_at AT TIME ZONE 'UTC',
                'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS appointment_start_at,
              to_char(appointment_end_at AT TIME ZONE 'UTC',
                'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS appointment_end_at,
              time_zone,
              facility_name, contact_name, contact_phone, access_instructions
       FROM load_revision_stops
       WHERE revision_id = $1
       ORDER BY sequence_number`,
      [revisionId]
    );
    return result.rows.map((row) => ({
      stopId: row.stop_id,
      sequenceNumber: row.sequence_number,
      type: row.stop_type,
      address: {
        addressLine1: row.address_line1,
        ...(row.address_line2 ? { addressLine2: row.address_line2 } : {}),
        city: row.city,
        stateCode: row.state_code,
        postalCode: row.postal_code,
        countryCode: row.country_code,
        ...(row.latitude !== null && row.longitude !== null
          ? {
              coordinates: {
                latitude: Number(row.latitude),
                longitude: Number(row.longitude),
              },
            }
          : {}),
      },
      appointmentWindow: {
        startAt: canonicalUtcTimestamp(row.appointment_start_at),
        endAt: canonicalUtcTimestamp(row.appointment_end_at),
        timeZone: row.time_zone,
      },
      ...(row.facility_name ? { facilityName: row.facility_name } : {}),
      ...(row.contact_name ? { contactName: row.contact_name } : {}),
      ...(row.contact_phone ? { contactPhone: row.contact_phone } : {}),
      ...(row.access_instructions ? { accessInstructions: row.access_instructions } : {}),
    }));
  }

  private async readFreightLines(revisionId: string): Promise<unknown[]> {
    const result = await this.pool.query<{
      freight_line_id: string;
      sequence_number: number;
      description: string;
      quantity: string;
      handling_unit_code: string;
      handling_unit_description: string | null;
      stackable: boolean;
      length: string | null;
      width: string | null;
      height: string | null;
      dimension_unit: string | null;
    }>(
      `SELECT freight_line_id, sequence_number, description, quantity::text, handling_unit_code,
              handling_unit_description, stackable, length::text, width::text,
              height::text, dimension_unit
       FROM load_revision_freight_lines
       WHERE revision_id = $1
       ORDER BY sequence_number`,
      [revisionId]
    );
    return result.rows.map((row) => ({
      freightLineId: row.freight_line_id,
      sequenceNumber: row.sequence_number,
      description: row.description,
      quantity: row.quantity,
      handlingUnitCode: row.handling_unit_code,
      ...(row.handling_unit_description
        ? { handlingUnitDescription: row.handling_unit_description }
        : {}),
      stackable: row.stackable,
      ...(row.length !== null &&
      row.width !== null &&
      row.height !== null &&
      row.dimension_unit !== null
        ? {
            dimensions: {
              length: row.length,
              width: row.width,
              height: row.height,
              unit: row.dimension_unit,
            },
          }
        : {}),
    }));
  }

  private async readSpecialHandlingCodes(revisionId: string): Promise<string[]> {
    const result = await this.pool.query<{ code: string }>(
      `SELECT code
       FROM load_revision_special_handling_codes
       WHERE revision_id = $1
       ORDER BY sequence_number`,
      [revisionId]
    );
    return result.rows.map(({ code }) => code);
  }

  private outboxRoutingKey(messageType: string): string {
    if (messageType === 'load.booked') {
      return LOAD_BOOKED_ROUTING_KEY;
    }
    throw new Error(`Unsupported Load outbox message type: ${messageType}`);
  }
}
