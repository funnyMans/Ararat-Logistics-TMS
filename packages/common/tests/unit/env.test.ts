import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createConfig, getRequiredEnv, getNumberEnv, getBooleanEnv } from '../../src/env';

describe('common env helpers', () => {
  it('reads required values from process.env', () => {
    process.env.TEST_SERVICE_PORT = '4000';
    expect(getRequiredEnv('TEST_SERVICE_PORT')).toBe('4000');
    delete process.env.TEST_SERVICE_PORT;
  });

  it('parses numeric values safely', () => {
    process.env.TEST_SERVICE_TIMEOUT = '1500';
    expect(getNumberEnv('TEST_SERVICE_TIMEOUT', 500)).toBe(1500);
    delete process.env.TEST_SERVICE_TIMEOUT;
  });

  it('parses boolean values safely', () => {
    process.env.TEST_SERVICE_ENABLED = 'true';
    expect(getBooleanEnv('TEST_SERVICE_ENABLED', false)).toBe(true);

    process.env.TEST_SERVICE_ENABLED = ' FALSE ';
    expect(getBooleanEnv('TEST_SERVICE_ENABLED', true)).toBe(false);

    process.env.TEST_SERVICE_ENABLED = 'YES';
    expect(getBooleanEnv('TEST_SERVICE_ENABLED', false)).toBe(true);
    delete process.env.TEST_SERVICE_ENABLED;
  });

  it('trims whitespace for required and numeric env values', () => {
    process.env.TEST_SERVICE_PORT = ' 4000 ';
    process.env.TEST_SERVICE_TIMEOUT = ' 1500 ';

    expect(getRequiredEnv('TEST_SERVICE_PORT')).toBe('4000');
    expect(getNumberEnv('TEST_SERVICE_TIMEOUT', 500)).toBe(1500);

    delete process.env.TEST_SERVICE_PORT;
    delete process.env.TEST_SERVICE_TIMEOUT;
  });

  it('creates a strongly typed config from a zod schema', () => {
    const config = createConfig({
      TEST_SERVICE_PORT: z.coerce.number().default(3001),
      TEST_SERVICE_NAME: z.string().default('test-service'),
      TEST_SERVICE_ENABLED: z.coerce.boolean().default(false),
    });

    expect(config.TEST_SERVICE_PORT).toBe(3001);
    expect(config.TEST_SERVICE_NAME).toBe('test-service');
    expect(config.TEST_SERVICE_ENABLED).toBe(false);
  });

  it('throws when required env values do not match the schema', () => {
    const env = {
      TEST_SERVICE_PORT: 'abc',
    };

    expect(() =>
      createConfig(
        {
          TEST_SERVICE_PORT: z.coerce.number().min(1),
        },
        env
      )
    ).toThrow(/TEST_SERVICE_PORT/i);
  });

  it('reports every invalid environment variable in one error', () => {
    const env = {
      TEST_SERVICE_PORT: 'abc',
      TEST_SERVICE_NAME: '',
    };

    expect(() =>
      createConfig(
        {
          TEST_SERVICE_PORT: z.coerce.number().min(1),
          TEST_SERVICE_NAME: z.string().min(1),
        },
        env
      )
    ).toThrow(/(?=.*TEST_SERVICE_PORT)(?=.*TEST_SERVICE_NAME)/s);
  });
});
