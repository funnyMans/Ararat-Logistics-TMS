import { describe, expect, it } from 'vitest';
import { readCapacityRuntimeConfig } from '../../src/infrastructure/config/runtime-config';

const validEnvironment = {
  CAPACITY_DATABASE_URL: 'postgres://capacity_runtime:secret@localhost:5432/capacity',
  CAPACITY_AMQP_URL: 'amqp://capacity_runtime:secret@localhost:5672/capacity_commitment',
  CAPACITY_COMMAND_QUEUE: 'capacity.commitment.commands',
  CAPACITY_OUTCOME_EXCHANGE: 'capacity.commitment.outcomes',
};

describe('Capacity Commitment runtime configuration', () => {
  it('accepts explicit database, broker, and topology configuration', () => {
    expect(readCapacityRuntimeConfig(validEnvironment)).toEqual({
      databaseUrl: validEnvironment.CAPACITY_DATABASE_URL,
      amqpUrl: validEnvironment.CAPACITY_AMQP_URL,
      commandQueue: validEnvironment.CAPACITY_COMMAND_QUEUE,
      outcomeExchange: validEnvironment.CAPACITY_OUTCOME_EXCHANGE,
      host: '0.0.0.0',
      port: 8080,
      workerPollIntervalMs: 1000,
    });
  });

  it('requires explicit service credentials and topology names', () => {
    expect(() => readCapacityRuntimeConfig({})).toThrow('CAPACITY_DATABASE_URL is required.');
    expect(() =>
      readCapacityRuntimeConfig({
        ...validEnvironment,
        CAPACITY_COMMAND_QUEUE: '',
      })
    ).toThrow('CAPACITY_COMMAND_QUEUE is required.');
  });

  it('rejects unsupported connection protocols and invalid worker intervals', () => {
    expect(() =>
      readCapacityRuntimeConfig({
        ...validEnvironment,
        CAPACITY_AMQP_URL: 'https://broker.example.invalid',
      })
    ).toThrow('CAPACITY_AMQP_URL must use amqp: or amqps:.');
    expect(() =>
      readCapacityRuntimeConfig({
        ...validEnvironment,
        CAPACITY_WORKER_POLL_INTERVAL_MS: '50',
      })
    ).toThrow('CAPACITY_WORKER_POLL_INTERVAL_MS must be at least 100 milliseconds.');
  });
});
