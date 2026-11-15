import { Pool } from 'pg';
import { runEconomicMigrations } from './infrastructure/persistence/economic-migration-runner';

async function main(): Promise<void> {
  const databaseUrl = process.env.ECONOMICS_MIGRATION_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('ECONOMICS_MIGRATION_DATABASE_URL is required.');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
  });

  try {
    await runEconomicMigrations(pool);
    console.info('Operational Economics migrations are current.');
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error('Operational Economics migration job failed.', error);
  process.exitCode = 1;
});
