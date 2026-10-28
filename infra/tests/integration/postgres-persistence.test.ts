import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const postgresIntegration = process.env.POSTGRES_INTEGRATION === '1' ? describe : describe.skip;
const composeArgs = ['compose', '-f', 'infra/docker-compose.dev.yml'];
const probeId = '00000000-0000-4000-8000-000000000001';

function runCompose(...args: string[]): string {
  return execFileSync('docker', [...composeArgs, ...args], {
    encoding: 'utf8',
    timeout: 10_000,
  }).trim();
}

function queryPostgres(sql: string): string {
  return execFileSync(
    'docker',
    [
      ...composeArgs,
      'exec',
      '-T',
      'postgres',
      'sh',
      '-c',
      'exec psql --no-psqlrc --quiet --set ON_ERROR_STOP=1 --tuples-only --no-align --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --command "$1"',
      'postgres-conformance',
      sql,
    ],
    {
      encoding: 'utf8',
      timeout: 10_000,
    }
  ).trim();
}

async function waitForPostgres(): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      if (queryPostgres('SELECT 1') === '1') {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('PostgreSQL did not become available after restart.', {
    cause: lastError,
  });
}

postgresIntegration('PostgreSQL persistence conformance', () => {
  it('retains committed conformance state after client and database restarts', async () => {
    queryPostgres(`
        CREATE SCHEMA IF NOT EXISTS foundation_conformance;
        CREATE TABLE IF NOT EXISTS foundation_conformance.restart_probe (
          probe_id uuid PRIMARY KEY,
          committed_value text NOT NULL
        );
        INSERT INTO foundation_conformance.restart_probe (probe_id, committed_value)
        VALUES ('${probeId}', 'committed')
        ON CONFLICT (probe_id) DO UPDATE
        SET committed_value = EXCLUDED.committed_value;
      `);

    expect(
      queryPostgres(
        `SELECT committed_value FROM foundation_conformance.restart_probe WHERE probe_id = '${probeId}'`
      )
    ).toBe('committed');

    runCompose('restart', 'postgres');
    await waitForPostgres();

    expect(
      queryPostgres(
        `SELECT committed_value FROM foundation_conformance.restart_probe WHERE probe_id = '${probeId}'`
      )
    ).toBe('committed');

    queryPostgres(`DELETE FROM foundation_conformance.restart_probe WHERE probe_id = '${probeId}'`);
  }, 45_000);
});
