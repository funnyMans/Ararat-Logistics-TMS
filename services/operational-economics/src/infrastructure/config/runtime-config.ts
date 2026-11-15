export interface OperationalEconomicsRuntimeConfig {
  databaseUrl: string;
  host: string;
  port: number;
}

function requiredValue(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function validateDatabaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('ECONOMICS_DATABASE_URL must be a valid URL.');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new TypeError('ECONOMICS_DATABASE_URL must use postgres: or postgresql:.');
  }
  return value;
}

function portValue(value: string): number {
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new RangeError('ECONOMICS_HTTP_PORT must be an integer from 1 to 65535.');
  }
  return port;
}

export function readOperationalEconomicsRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env
): OperationalEconomicsRuntimeConfig {
  return {
    databaseUrl: validateDatabaseUrl(requiredValue(environment, 'ECONOMICS_DATABASE_URL')),
    host: environment.ECONOMICS_HTTP_HOST?.trim() || '0.0.0.0',
    port: portValue(environment.ECONOMICS_HTTP_PORT?.trim() || '8080'),
  };
}
