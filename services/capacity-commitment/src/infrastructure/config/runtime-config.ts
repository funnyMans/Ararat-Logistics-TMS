export interface CapacityRuntimeConfig {
  databaseUrl: string;
  amqpUrl: string;
  commandQueue: string;
  outcomeExchange: string;
  host: string;
  port: number;
  workerPollIntervalMs: number;
}

function requiredValue(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function validateUrl(value: string, name: string, protocols: string[]): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${name} must be a valid URL.`);
  }
  if (!protocols.includes(url.protocol)) {
    throw new TypeError(`${name} must use ${protocols.join(' or ')}.`);
  }
  return value;
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
  return parsed;
}

export function readCapacityRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env
): CapacityRuntimeConfig {
  const port = positiveInteger(
    environment.CAPACITY_HTTP_PORT?.trim() || '8080',
    'CAPACITY_HTTP_PORT'
  );
  if (port > 65_535) {
    throw new RangeError('CAPACITY_HTTP_PORT must not exceed 65535.');
  }

  const workerPollIntervalMs = positiveInteger(
    environment.CAPACITY_WORKER_POLL_INTERVAL_MS?.trim() || '1000',
    'CAPACITY_WORKER_POLL_INTERVAL_MS'
  );
  if (workerPollIntervalMs < 100) {
    throw new RangeError('CAPACITY_WORKER_POLL_INTERVAL_MS must be at least 100 milliseconds.');
  }

  return {
    databaseUrl: validateUrl(
      requiredValue(environment, 'CAPACITY_DATABASE_URL'),
      'CAPACITY_DATABASE_URL',
      ['postgres:', 'postgresql:']
    ),
    amqpUrl: validateUrl(requiredValue(environment, 'CAPACITY_AMQP_URL'), 'CAPACITY_AMQP_URL', [
      'amqp:',
      'amqps:',
    ]),
    commandQueue: requiredValue(environment, 'CAPACITY_COMMAND_QUEUE'),
    outcomeExchange: requiredValue(environment, 'CAPACITY_OUTCOME_EXCHANGE'),
    host: environment.CAPACITY_HTTP_HOST?.trim() || '0.0.0.0',
    port,
    workerPollIntervalMs,
  };
}
