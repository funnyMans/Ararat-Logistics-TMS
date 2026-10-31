import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IdentityProviderUnavailableError,
  IdentityTokenVerificationError,
} from '@app/identity-token';
import type { IdentityTokenClaims } from '@app/identity-token';
import { registerIdentityAuthentication } from '../../../../../src/interfaces/http/hooks/identity-authentication';
import { registerHealthRoutes } from '../../../../../src/interfaces/http/routes/health';
import { registerServiceMetrics } from '@app/common';

const claims: IdentityTokenClaims = {
  iss: 'https://identity.example.test',
  aud: 'tms-api',
  sub: 'principal-1',
  iat: 1,
  exp: 2,
  jti: 'token-1',
  sid: 'session-1',
  auth_time: 1,
  amr: ['pwd'],
  grantVersion: 1,
  grants: [{ role: 'broker', scopeType: 'area', scopeId: 'west_north_central' }],
};

describe('identity authentication hook', () => {
  const servers: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
    vi.restoreAllMocks();
  });

  function createServer(verify: (token: string) => Promise<IdentityTokenClaims>) {
    const server = Fastify();
    servers.push(server);
    registerIdentityAuthentication(server, { verify });
    registerHealthRoutes(server);
    registerServiceMetrics(server, 'api-gateway-test');
    server.get('/protected', async (request) => ({ principalId: request.identity?.sub }));
    return server;
  }

  it('keeps health and readiness public while requiring bearer auth for other routes', async () => {
    const server = createServer(async () => claims);

    expect((await server.inject('/health')).statusCode).toBe(200);
    expect((await server.inject('/ready')).statusCode).toBe(200);
    expect((await server.inject('/metrics')).statusCode).toBe(200);

    const response = await server.inject('/protected');
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: { code: 'AUTHENTICATION_REQUIRED', retryable: false },
    });
  });

  it('attaches verified claims to the request without making domain authorization decisions', async () => {
    const verifier = vi.fn(async () => claims);
    const server = createServer(verifier);

    const response = await server.inject({
      url: '/protected',
      headers: { authorization: 'Bearer signed-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ principalId: 'principal-1' });
    expect(verifier).toHaveBeenCalledWith('signed-token');
  });

  it('returns 401 for invalid tokens and 503 when signing keys are unavailable', async () => {
    const server = createServer(async () => {
      throw new IdentityTokenVerificationError();
    });
    const invalid = await server.inject({
      url: '/protected',
      headers: { authorization: 'Bearer invalid-token' },
    });
    expect(invalid.statusCode).toBe(401);

    const unavailableServer = createServer(async () => {
      throw new IdentityProviderUnavailableError();
    });
    const unavailable = await unavailableServer.inject({
      url: '/protected',
      headers: { authorization: 'Bearer signed-token' },
    });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json()).toMatchObject({
      error: { code: 'IDENTITY_KEY_SET_UNAVAILABLE', retryable: true },
    });
  });

  it('fails closed when verifier configuration is missing', async () => {
    const server = Fastify();
    servers.push(server);
    registerIdentityAuthentication(server, undefined);
    server.get('/protected', async () => ({ protected: true }));

    const response = await server.inject('/protected');
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: { code: 'IDENTITY_AUTHENTICATION_UNAVAILABLE', retryable: true },
    });
  });
});
