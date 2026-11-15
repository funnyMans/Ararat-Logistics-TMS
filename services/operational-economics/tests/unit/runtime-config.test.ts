import { describe, expect, it } from 'vitest';
import { readOperationalEconomicsRuntimeConfig } from '../../src/infrastructure/config/runtime-config';

describe('Operational Economics runtime configuration', () => {
  it('requires a PostgreSQL connection URL and validates the HTTP port', () => {
    expect(() => readOperationalEconomicsRuntimeConfig({})).toThrow(
      'ECONOMICS_DATABASE_URL is required.'
    );
    expect(() =>
      readOperationalEconomicsRuntimeConfig({
        ECONOMICS_DATABASE_URL: 'https://database.example',
      })
    ).toThrow('ECONOMICS_DATABASE_URL must use postgres: or postgresql:.');
    expect(() =>
      readOperationalEconomicsRuntimeConfig({
        ECONOMICS_DATABASE_URL: 'postgresql://localhost/economics',
        ECONOMICS_HTTP_PORT: '65536',
      })
    ).toThrow('ECONOMICS_HTTP_PORT must be an integer from 1 to 65535.');
  });

  it('uses the service defaults after validating required settings', () => {
    expect(
      readOperationalEconomicsRuntimeConfig({
        ECONOMICS_DATABASE_URL: 'postgresql://localhost/economics',
      })
    ).toEqual({
      databaseUrl: 'postgresql://localhost/economics',
      host: '0.0.0.0',
      port: 8080,
    });
  });
});
