import { Pool } from 'pg';
import { runCapacityMigrations } from './infrastructure/persistence/capacity-migration-runner';

async function main(): Promise<void> {
  const databaseUrl = process.env.CAPACITY_MIGRATION_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('CAPACITY_MIGRATION_DATABASE_URL is required.');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
  });

  try {
    await runCapacityMigrations(pool);
    console.info('Capacity Commitment migrations are current.');
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error('Capacity Commitment migration job failed.', error);
  process.exitCode = 1;
});
