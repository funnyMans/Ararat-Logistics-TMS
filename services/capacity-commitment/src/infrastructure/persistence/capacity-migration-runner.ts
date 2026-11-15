import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';

const MIGRATION_LOCK_CLASS = 730_401;
const MIGRATION_LOCK_OBJECT = 1;
const MIGRATION_TABLE = 'capacity_schema_migrations';

function defaultMigrationDirectory(): string {
  const packageMigrationDirectory = join(process.cwd(), 'migrations');
  return existsSync(packageMigrationDirectory)
    ? packageMigrationDirectory
    : join(process.cwd(), 'services/capacity-commitment/migrations');
}

export async function runCapacityMigrations(
  pool: Pool,
  migrationDirectory = defaultMigrationDirectory()
): Promise<void> {
  const sqlFiles = readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql'));
  const invalidFiles = sqlFiles.filter((name) => !/^\d{3}_[a-z0-9_]+\.sql$/.test(name));
  if (invalidFiles.length > 0) {
    throw new Error(
      `Invalid Capacity Commitment migration filename(s): ${invalidFiles.join(', ')}.`
    );
  }
  const migrationFiles = sqlFiles.sort();
  if (migrationFiles.length === 0) {
    throw new Error(`No Capacity Commitment migrations found in "${migrationDirectory}".`);
  }

  const client = await pool.connect();
  let locked = false;
  try {
    await client.query('SELECT pg_advisory_lock($1, $2)', [
      MIGRATION_LOCK_CLASS,
      MIGRATION_LOCK_OBJECT,
    ]);
    locked = true;
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
         version text PRIMARY KEY,
         checksum text NOT NULL CHECK (length(checksum) = 64),
         applied_at timestamptz NOT NULL DEFAULT now()
       )`
    );

    for (const filename of migrationFiles) {
      const version = filename.slice(0, -4);
      const sql = readFileSync(join(migrationDirectory, filename), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ checksum: string }>(
        `SELECT checksum FROM ${MIGRATION_TABLE} WHERE version = $1`,
        [version]
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(
            `Applied Capacity Commitment migration "${version}" has changed; add a forward migration instead.`
          );
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(`INSERT INTO ${MIGRATION_TABLE} (version, checksum) VALUES ($1, $2)`, [
          version,
          checksum,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            `Capacity Commitment migration "${version}" and its rollback both failed.`
          );
        }
        throw error;
      }
    }
  } finally {
    try {
      if (locked) {
        await client.query('SELECT pg_advisory_unlock($1, $2)', [
          MIGRATION_LOCK_CLASS,
          MIGRATION_LOCK_OBJECT,
        ]);
      }
    } finally {
      client.release();
    }
  }
}
