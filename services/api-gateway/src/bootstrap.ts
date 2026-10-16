import Fastify from 'fastify';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { createLogger, createServiceBootstrap, registerServiceMetrics } from '@app/common';
import { config } from './infrastructure/config';
import { registerHealthRoutes } from './interfaces/http/routes/health';

export function createServer(): {
  server: FastifyInstance;
  shutdown: () => Promise<void>;
} {
  const logger: FastifyBaseLogger = createLogger('api-gateway', config.LOG_LEVEL);
  const server = Fastify({ loggerInstance: logger });

  const { shutdown } = createServiceBootstrap(server, {
    serviceName: 'api-gateway',
    observabilityEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  registerHealthRoutes(server);

  registerServiceMetrics(server, 'api-gateway');

  return { server, shutdown };
}
