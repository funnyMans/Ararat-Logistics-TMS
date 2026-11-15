import type { Server } from 'node:http';
import { Pool } from 'pg';
import { readOperationalEconomicsRuntimeConfig } from './infrastructure/config/runtime-config';
import { createOperationalEconomicsHttpServer } from './infrastructure/http/operational-economics-http-server';
import { PostgresEconomicEstimateRecordRepository } from './infrastructure/persistence/postgres-economic-estimate-record-repository';

function log(level: 'info' | 'error', message: string, error?: unknown): void {
  console[level](
    JSON.stringify({
      level,
      service: 'operational-economics',
      message,
      ...(error === undefined
        ? {}
        : {
            error:
              error instanceof Error ? { name: error.name, message: error.message } : String(error),
          }),
    })
  );
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function run(): Promise<void> {
  const config = readOperationalEconomicsRuntimeConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 5_000,
    statement_timeout: 5_000,
  });
  const health = { startupComplete: false };
  const repository = new PostgresEconomicEstimateRecordRepository(pool);
  let server: Server | undefined;
  let shutdownPromise: Promise<void> | undefined;

  const shutdown = (exitCode = 0): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }
    health.startupComplete = false;
    shutdownPromise = (async () => {
      const cleanups: Array<[string, () => Promise<unknown>]> = [];
      if (server?.listening) {
        cleanups.push(['close HTTP server', () => closeServer(server!)]);
      }
      cleanups.push(['close PostgreSQL pool', () => pool.end()]);
      const results = await Promise.allSettled(cleanups.map(([, cleanup]) => cleanup()));
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          log(
            'error',
            `Failed to ${cleanups[index]?.[0] ?? 'clean up runtime resource'}.`,
            result.reason
          );
          exitCode = 1;
        }
      });
      process.exitCode = exitCode;
    })();
    return shutdownPromise;
  };

  try {
    pool.on('error', (error: Error) => log('error', 'Unexpected PostgreSQL pool error.', error));
    await pool.query('SELECT 1');
    const schema = await pool.query<{ estimates: string | null }>(
      `SELECT to_regclass('economic_estimate_records') AS estimates`
    );
    if (!schema.rows[0]?.estimates) {
      throw new Error('Operational Economics migrations have not been applied.');
    }

    server = createOperationalEconomicsHttpServer(repository, health, async () => {
      const result = await pool.query<{ estimates: string | null }>(
        `SELECT to_regclass('economic_estimate_records') AS estimates`
      );
      return Boolean(result.rows[0]?.estimates);
    });
    await listen(server, config.port, config.host);
    health.startupComplete = true;
    process.once('SIGTERM', () => void shutdown());
    process.once('SIGINT', () => void shutdown());
    log('info', `Operational Economics runtime listening on ${config.host}:${config.port}.`);
  } catch (error) {
    await shutdown(1);
    throw error;
  }
}

void run().catch((error: unknown) => {
  log('error', 'Operational Economics runtime failed to start.', error);
  process.exitCode = 1;
});
