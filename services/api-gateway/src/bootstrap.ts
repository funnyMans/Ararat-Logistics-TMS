import Fastify from 'fastify';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { createLogger, createServiceBootstrap, registerServiceMetrics } from '@app/common';
import { config } from './infrastructure/config';
import { createIdentityTokenVerifier } from './infrastructure/auth/identity-token-verifier';
import { registerIdentityAuthentication } from './interfaces/http/hooks/identity-authentication';
import { registerHealthRoutes } from './interfaces/http/routes/health';

export function createServer(): {
  server: FastifyInstance;
  shutdown: () => Promise<void>;
  markReady: () => void;
} {
  const logger: FastifyBaseLogger = createLogger('api-gateway', config.LOG_LEVEL);
  const server = Fastify({ loggerInstance: logger });
  let ready = false;

  const { shutdown: shutdownService } = createServiceBootstrap(server, {
    serviceName: 'api-gateway',
    observabilityEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  const identityVerifier =
    config.IDENTITY_ISSUER && config.IDENTITY_AUDIENCE && config.IDENTITY_JWKS_URI
      ? createIdentityTokenVerifier({
          issuer: config.IDENTITY_ISSUER,
          audience: config.IDENTITY_AUDIENCE,
          jwksUri: config.IDENTITY_JWKS_URI,
        })
      : undefined;

  registerIdentityAuthentication(server, identityVerifier);
  registerHealthRoutes(server, () => ready);

  registerServiceMetrics(server, 'api-gateway');

  const shutdown = () => {
    ready = false;
    return shutdownService();
  };

  return {
    server,
    shutdown,
    markReady: () => {
      ready = true;
    },
  };
}
