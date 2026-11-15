import { createHash } from 'node:crypto';
import type { Pool, QueryResultRow } from 'pg';
import {
  economicEstimateRecordSchema,
  type EconomicEstimateRecord,
  type EconomicEstimateRecordInput,
} from '../../domain/economic-estimate-record';
import {
  EconomicEstimateIdConflictError,
  type EconomicEstimateRecordRepository,
} from '../../application/ports/economic-estimate-record-repository';

type EstimateRow = QueryResultRow & {
  estimate_id: string;
  scope_type: 'load' | 'candidate';
  load_id: string;
  load_revision: string;
  trio_id: string | null;
  trio_revision: string | null;
  contract_version: string;
  model_version: string;
  input_schema_version: string;
  result_schema_version: string;
  input_snapshot: Record<string, unknown>;
  result_snapshot: Record<string, unknown>;
  provenance: EconomicEstimateRecordInput['provenance'];
  generated_at: Date;
  recorded_at: Date;
  record_hash: Buffer;
};

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

function recordHash(record: EconomicEstimateRecordInput): Buffer {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(record)))
    .digest();
}

function toRecord(row: EstimateRow): EconomicEstimateRecord {
  let scope: EconomicEstimateRecordInput['scope'];
  if (row.scope_type === 'load') {
    scope = {
      type: 'load',
      loadId: row.load_id,
      loadRevision: row.load_revision,
    };
  } else {
    if (!row.trio_id || !row.trio_revision) {
      throw new Error(`Candidate estimate "${row.estimate_id}" is missing its Trio identity.`);
    }
    scope = {
      type: 'candidate',
      loadId: row.load_id,
      loadRevision: row.load_revision,
      trioId: row.trio_id,
      trioRevision: row.trio_revision,
    };
  }
  return economicEstimateRecordSchema.parse({
    contractVersion: row.contract_version,
    estimateId: row.estimate_id,
    scope,
    modelVersion: row.model_version,
    inputSchemaVersion: row.input_schema_version,
    resultSchemaVersion: row.result_schema_version,
    inputs: row.input_snapshot,
    result: row.result_snapshot,
    provenance: row.provenance,
    generatedAt: row.generated_at.toISOString(),
    recordedAt: row.recorded_at.toISOString(),
  });
}

const selectColumns = `estimate_id, scope_type, load_id, load_revision, trio_id, trio_revision,
  contract_version, model_version, input_schema_version, result_schema_version,
  input_snapshot, result_snapshot, provenance, generated_at, recorded_at, record_hash`;

export class PostgresEconomicEstimateRecordRepository implements EconomicEstimateRecordRepository {
  constructor(private readonly pool: Pool) {}

  async create(
    record: EconomicEstimateRecordInput
  ): Promise<{ record: EconomicEstimateRecord; created: boolean }> {
    const hash = recordHash(record);
    const { scope } = record;
    const inserted = await this.pool.query<EstimateRow>(
      `INSERT INTO economic_estimate_records (
         estimate_id, scope_type, load_id, load_revision, trio_id, trio_revision,
         contract_version, model_version, input_schema_version, result_schema_version,
         input_snapshot, result_snapshot, provenance, generated_at, record_hash
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14, $15)
       ON CONFLICT (estimate_id) DO NOTHING
       RETURNING ${selectColumns}`,
      [
        record.estimateId,
        scope.type,
        scope.loadId,
        scope.loadRevision,
        scope.type === 'candidate' ? scope.trioId : null,
        scope.type === 'candidate' ? scope.trioRevision : null,
        record.contractVersion,
        record.modelVersion,
        record.inputSchemaVersion,
        record.resultSchemaVersion,
        JSON.stringify(record.inputs),
        JSON.stringify(record.result),
        JSON.stringify(record.provenance),
        record.generatedAt,
        hash,
      ]
    );

    if (inserted.rows[0]) {
      return { record: toRecord(inserted.rows[0]), created: true };
    }

    const existing = await this.pool.query<EstimateRow>(
      `SELECT ${selectColumns} FROM economic_estimate_records WHERE estimate_id = $1`,
      [record.estimateId]
    );
    const row = existing.rows[0];
    if (!row || !row.record_hash.equals(hash)) {
      throw new EconomicEstimateIdConflictError();
    }
    return { record: toRecord(row), created: false };
  }

  async findById(estimateId: string): Promise<EconomicEstimateRecord | null> {
    const result = await this.pool.query<EstimateRow>(
      `SELECT ${selectColumns} FROM economic_estimate_records WHERE estimate_id = $1`,
      [estimateId]
    );
    const row = result.rows[0];
    return row ? toRecord(row) : null;
  }

  async findByLoad(
    loadId: string,
    trioId: string | undefined,
    limit: number,
    cursor?: { recordedAt: string; estimateId: string }
  ): Promise<EconomicEstimateRecord[]> {
    const result = await this.pool.query<EstimateRow>(
      `SELECT ${selectColumns}
       FROM economic_estimate_records
       WHERE load_id = $1
         AND ($2::uuid IS NULL OR trio_id = $2)
         AND ($3::timestamptz IS NULL OR (recorded_at, estimate_id) < ($3::timestamptz, $4::uuid))
       ORDER BY recorded_at DESC, estimate_id DESC
       LIMIT $5`,
      [loadId, trioId ?? null, cursor?.recordedAt ?? null, cursor?.estimateId ?? null, limit]
    );
    return result.rows.map(toRecord);
  }
}
