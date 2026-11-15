import { randomUUIDv7 } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import type { EconomicEstimateRecordInput } from '../../src/domain/economic-estimate-record';
import { runEconomicMigrations } from '../../src/infrastructure/persistence/economic-migration-runner';
import { PostgresEconomicEstimateRecordRepository } from '../../src/infrastructure/persistence/postgres-economic-estimate-record-repository';

const postgresIntegration = process.env.ECONOMICS_PG_INTEGRATION === '1' ? describe : describe.skip;
const migrationDirectory = fileURLToPath(new URL('../../migrations/', import.meta.url));

function makeRecord(
  estimateId = randomUUIDv7(),
  scope: EconomicEstimateRecordInput['scope'] = {
    type: 'load',
    loadId: randomUUIDv7(),
    loadRevision: '17',
  }
): EconomicEstimateRecordInput {
  return {
    contractVersion: '1.0.0',
    estimateId,
    scope,
    modelVersion: 'model-pending',
    inputSchemaVersion: 'inputs-pending',
    resultSchemaVersion: 'result-pending',
    inputs: { source: 'not-yet-defined' },
    result: { status: 'not-yet-defined' },
    provenance: [],
    generatedAt: new Date().toISOString(),
  };
}

postgresIntegration('Operational Economics estimate persistence', () => {
  it('applies immutable migrations and persists idempotent versioned records', async () => {
    const connectionString = process.env.ECONOMICS_MIGRATION_DATABASE_URL;
    if (!connectionString) {
      throw new Error('ECONOMICS_MIGRATION_DATABASE_URL is required for this integration test.');
    }

    const schema = `economics_test_${randomUUIDv7().replaceAll('-', '')}`;
    const adminPool = new Pool({ connectionString });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const pool = new Pool({ connectionString, options: `-c search_path=${schema}` });

    try {
      await runEconomicMigrations(pool, migrationDirectory);
      await runEconomicMigrations(pool, migrationDirectory);
      const appliedMigrations = await pool.query<{ version: string; checksum: string }>(
        'SELECT version, checksum FROM economics_schema_migrations ORDER BY version'
      );
      expect(appliedMigrations.rows).toHaveLength(1);
      expect(appliedMigrations.rows[0]?.version).toBe('001_economic_estimate_records');

      const originalChecksum = appliedMigrations.rows[0]?.checksum;
      if (!originalChecksum) {
        throw new Error('Operational Economics migration checksum was not recorded.');
      }
      await pool.query('UPDATE economics_schema_migrations SET checksum = $1', ['0'.repeat(64)]);
      try {
        await expect(runEconomicMigrations(pool, migrationDirectory)).rejects.toThrow(
          /has changed; add a forward migration instead/
        );
      } finally {
        await pool.query('UPDATE economics_schema_migrations SET checksum = $1', [
          originalChecksum,
        ]);
      }

      const repository = new PostgresEconomicEstimateRecordRepository(pool);
      const loadRecord = makeRecord();
      const createdLoad = await repository.create(loadRecord);
      expect(createdLoad.created).toBe(true);
      expect(await repository.create(loadRecord)).toEqual({
        record: createdLoad.record,
        created: false,
      });

      const candidateRecord = makeRecord(randomUUIDv7(), {
        type: 'candidate',
        loadId: loadRecord.scope.loadId,
        loadRevision: '17',
        trioId: randomUUIDv7(),
        trioRevision: '6',
      });
      await repository.create(candidateRecord);
      expect((await repository.findById(candidateRecord.estimateId))?.scope).toEqual(
        candidateRecord.scope
      );
      expect(await repository.findByLoad(loadRecord.scope.loadId, undefined, 10)).toHaveLength(2);
      expect(
        await repository.findByLoad(
          loadRecord.scope.loadId,
          candidateRecord.scope.type === 'candidate' ? candidateRecord.scope.trioId : undefined,
          10
        )
      ).toHaveLength(1);

      await expect(
        repository.create({ ...loadRecord, result: { status: 'different' } })
      ).rejects.toThrow('An estimate ID was reused with different estimate content.');
    } finally {
      await pool.end();
      await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
      await adminPool.end();
    }
  });
});
