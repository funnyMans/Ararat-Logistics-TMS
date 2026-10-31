import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const recoveryIntegration =
  process.env.FOUNDATION_RECOVERY_INTEGRATION === '1' ? describe : describe.skip;
const composeArgs = ['compose', '-f', 'infra/docker-compose.dev.yml'];
const runId = randomUUID().replaceAll('-', '');
const schema = `foundation_recovery_${runId.slice(0, 16)}`;
const restoreDatabase = `foundation_restore_${runId.slice(0, 16)}`;

function queryPostgres(sql: string, database?: string): string {
  return execFileSync(
    'docker',
    [
      ...composeArgs,
      'exec',
      '-T',
      'postgres',
      'sh',
      '-c',
      'exec psql --no-psqlrc --quiet --set ON_ERROR_STOP=1 --tuples-only --no-align --username "$POSTGRES_USER" --dbname "${1:-$POSTGRES_DB}" --command "$2"',
      'foundation-recovery',
      database ?? '',
      sql,
    ],
    {
      encoding: 'utf8',
      timeout: 15_000,
    }
  ).trim();
}

function runPostgresCommand(command: 'createdb' | 'dropdb', database: string): void {
  execFileSync(
    'docker',
    [
      ...composeArgs,
      'exec',
      '-T',
      'postgres',
      'sh',
      '-c',
      `exec ${command} --username "$POSTGRES_USER" ${command === 'dropdb' ? '--if-exists --force ' : ''}"$1"`,
      'foundation-recovery',
      database,
    ],
    {
      encoding: 'utf8',
      timeout: 15_000,
    }
  );
}

function dumpSchema(schemaName: string): Buffer {
  return execFileSync(
    'docker',
    [
      ...composeArgs,
      'exec',
      '-T',
      'postgres',
      'sh',
      '-c',
      'exec pg_dump --format=custom --no-owner --no-acl --schema="$1" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"',
      'foundation-recovery',
      schemaName,
    ],
    { timeout: 30_000 }
  );
}

function restoreSchema(backup: Buffer, database: string): void {
  execFileSync(
    'docker',
    [
      ...composeArgs,
      'exec',
      '-T',
      'postgres',
      'sh',
      '-c',
      'exec pg_restore --exit-on-error --no-owner --no-acl --username "$POSTGRES_USER" --dbname "$1"',
      'foundation-recovery',
      database,
    ],
    {
      input: backup,
      timeout: 30_000,
    }
  );
}

recoveryIntegration('Foundation recovery acceptance', () => {
  it('rejects a failed transaction without retaining partial state', () => {
    try {
      queryPostgres(`
        CREATE SCHEMA ${schema};
        CREATE TABLE ${schema}.atomicity_probe (
          probe_id text PRIMARY KEY,
          probe_value text NOT NULL,
          CONSTRAINT atomicity_probe_value_unique UNIQUE (probe_value)
            DEFERRABLE INITIALLY DEFERRED
        );
      `);

      expect(() =>
        queryPostgres(`
          BEGIN;
          INSERT INTO ${schema}.atomicity_probe (probe_id, probe_value)
          VALUES ('before-failure', 'duplicate');
          INSERT INTO ${schema}.atomicity_probe (probe_id, probe_value)
          VALUES ('injected-failure', 'duplicate');
          COMMIT;
        `)
      ).toThrow(/unique constraint/i);

      expect(queryPostgres(`SELECT count(*) FROM ${schema}.atomicity_probe`)).toBe('0');
    } finally {
      queryPostgres(`DROP SCHEMA IF EXISTS ${schema} CASCADE;`);
    }
  }, 30_000);

  it('restores a schema backup into a disposable database without changing the source', () => {
    let databaseCreated = false;

    try {
      queryPostgres(`
        CREATE SCHEMA ${schema};
        CREATE TABLE ${schema}.restore_probe (
          probe_id uuid PRIMARY KEY,
          committed_value text NOT NULL
        );
        INSERT INTO ${schema}.restore_probe (probe_id, committed_value)
        VALUES ('${randomUUID()}', 'backup-restored');
      `);

      const sourceValue = queryPostgres(`SELECT committed_value FROM ${schema}.restore_probe`);
      const backup = dumpSchema(schema);

      runPostgresCommand('createdb', restoreDatabase);
      databaseCreated = true;
      restoreSchema(backup, restoreDatabase);

      expect(
        queryPostgres(`SELECT committed_value FROM ${schema}.restore_probe`, restoreDatabase)
      ).toBe(sourceValue);
      expect(queryPostgres(`SELECT count(*) FROM ${schema}.restore_probe`)).toBe('1');
    } finally {
      if (databaseCreated) {
        runPostgresCommand('dropdb', restoreDatabase);
      }
      queryPostgres(`DROP SCHEMA IF EXISTS ${schema} CASCADE;`);
    }
  }, 60_000);
});
