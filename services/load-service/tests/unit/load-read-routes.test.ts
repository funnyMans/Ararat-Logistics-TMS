import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIdentityTokenVerifier } from '@app/identity-token';
import type { IdentityTokenClaims } from '@app/identity-token';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { LoadReads } from '../../src/application/queries/load-reads';
import type { LoadReadRepository } from '../../src/application/ports/load-read-repository';
import { SubmitBooking } from '../../src/application/commands/submit-booking';
import type {
  LoadCustomerBookingFactReader,
  LoadBookingSubmissionRepository,
  LoadPickupAreaResolver,
} from '../../src/application/ports/load-booking-ports';
import { registerLoadRoutes } from '../../src/interfaces/http/register-load-routes';

const brokerIdentity: IdentityTokenClaims = {
  iss: 'https://identity.example.test',
  aud: 'tms-api',
  sub: 'broker-1',
  iat: 1,
  exp: 2,
  jti: 'token-1',
  sid: 'session-1',
  auth_time: 1,
  amr: ['pwd', 'otp'],
  grantVersion: 1,
  grants: [{ role: 'broker', scopeType: 'area', scopeId: 'la' }],
};

const loadRepresentation = { id: 'load-1', areaId: 'la', status: 'BOOKED' };
const customerFactReader: LoadCustomerBookingFactReader = {
  getUsableOrRequestReconciliation: vi.fn(async () => ({
    available: true,
    fact: {
      result: 'FOUND',
      status: 'ACTIVE',
      legalName: 'Customer One',
      ownerRevision: 1,
      registrySequence: 1,
    },
  })),
};

describe('Load read routes', () => {
  const servers: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
    vi.restoreAllMocks();
  });

  function createServer(
    repository: LoadReadRepository,
    verifierConfigured = true,
    submitBooking?: SubmitBooking
  ) {
    const server = Fastify();
    servers.push(server);
    registerLoadRoutes(
      server,
      new LoadReads(repository),
      verifierConfigured ? { verify: async () => brokerIdentity } : undefined,
      submitBooking
    );
    return server;
  }

  it('authenticates, derives booking areas, and authorizes before dispatching the write', async () => {
    const repository: LoadReadRepository = {
      findLoad: vi.fn(async () => null),
      findRevision: vi.fn(async () => null),
      findBookingSubmission: vi.fn(async () => null),
    };
    const areaResolver: LoadPickupAreaResolver = {
      resolveFirstPickupAreas: vi.fn(async () => ['la']),
    };
    const bookingRepository: LoadBookingSubmissionRepository = {
      findSubmission: vi.fn(async () => null),
      createSubmission: vi.fn(async (_identity, _request, _areaIds, _customerFacts) => ({
        submissionId: 'submission-1',
        replayed: false,
        representation: { status: 'accepted' },
      })),
    };
    const server = createServer(
      repository,
      true,
      new SubmitBooking(areaResolver, bookingRepository, customerFactReader)
    );

    const noToken = await server.inject({
      method: 'POST',
      url: '/api/v1/booking-submissions',
      payload: { rows: [{}] },
    });
    expect(noToken.statusCode).toBe(401);
    expect(areaResolver.resolveFirstPickupAreas).not.toHaveBeenCalled();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/booking-submissions',
      headers: { authorization: 'Bearer test-token', 'idempotency-key': 'key-1' },
      payload: { rows: [{ areaId: 'la' }] },
    });
    expect(response.statusCode).toBe(201);
    expect(response.headers.location).toBe('/api/v1/booking-submissions/submission-1');
    expect(response.json()).toEqual({ status: 'accepted' });
    expect(bookingRepository.createSubmission).toHaveBeenCalledWith(
      brokerIdentity,
      { rows: [{ areaId: 'la' }], idempotencyKey: 'key-1' },
      ['la'],
      {}
    );

    vi.mocked(bookingRepository.createSubmission).mockResolvedValue({
      submissionId: 'submission-1',
      replayed: true,
      representation: { status: 'accepted' },
    });
    const replay = await server.inject({
      method: 'POST',
      url: '/api/v1/booking-submissions',
      headers: { authorization: 'Bearer test-token', 'idempotency-key': 'key-1' },
      payload: { rows: [{ areaId: 'la' }] },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.headers.location).toBeUndefined();
  });

  it('requires an idempotency key before resolving or dispatching a booking', async () => {
    const repository: LoadReadRepository = {
      findLoad: vi.fn(async () => null),
      findRevision: vi.fn(async () => null),
      findBookingSubmission: vi.fn(async () => null),
    };
    const areaResolver: LoadPickupAreaResolver = {
      resolveFirstPickupAreas: vi.fn(async () => ['la']),
    };
    const bookingRepository: LoadBookingSubmissionRepository = {
      findSubmission: vi.fn(async () => null),
      createSubmission: vi.fn(async (_identity, _request, _areaIds, _customerFacts) => ({
        submissionId: 'submission-1',
        replayed: false,
        representation: { status: 'accepted' },
      })),
    };
    const server = createServer(
      repository,
      true,
      new SubmitBooking(areaResolver, bookingRepository, customerFactReader)
    );

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/booking-submissions',
      headers: { authorization: 'Bearer test-token' },
      payload: { rows: [{}] },
    });
    expect(response.statusCode).toBe(400);
    expect(areaResolver.resolveFirstPickupAreas).not.toHaveBeenCalled();
    expect(bookingRepository.createSubmission).not.toHaveBeenCalled();
  });

  it('does not dispatch booking writes when the derived area is not granted', async () => {
    const repository: LoadReadRepository = {
      findLoad: vi.fn(async () => null),
      findRevision: vi.fn(async () => null),
      findBookingSubmission: vi.fn(async () => null),
    };
    const areaResolver: LoadPickupAreaResolver = {
      resolveFirstPickupAreas: vi.fn(async () => ['pacific']),
    };
    const bookingRepository: LoadBookingSubmissionRepository = {
      findSubmission: vi.fn(async () => null),
      createSubmission: vi.fn(async (_identity, _request, _areaIds, _customerFacts) => ({
        submissionId: 'submission-1',
        replayed: false,
        representation: { status: 'accepted' },
      })),
    };
    const server = createServer(
      repository,
      true,
      new SubmitBooking(areaResolver, bookingRepository, customerFactReader)
    );

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/booking-submissions',
      headers: { authorization: 'Bearer test-token', 'idempotency-key': 'key-1' },
      payload: { rows: [{}] },
    });
    expect(response.statusCode).toBe(403);
    expect(bookingRepository.createSubmission).not.toHaveBeenCalled();
  });

  it('returns the retryable Customer status error without persisting when facts are stale', async () => {
    const repository: LoadReadRepository = {
      findLoad: vi.fn(async () => null),
      findRevision: vi.fn(async () => null),
      findBookingSubmission: vi.fn(async () => null),
    };
    const areaResolver: LoadPickupAreaResolver = {
      resolveFirstPickupAreas: vi.fn(async () => ['la']),
    };
    const bookingRepository: LoadBookingSubmissionRepository = {
      findSubmission: vi.fn(async () => null),
      createSubmission: vi.fn(async (_identity, _request, _areaIds, _customerFacts) => ({
        submissionId: 'submission-1',
        replayed: false,
        representation: { status: 'accepted' },
      })),
    };
    const staleCustomerFacts: LoadCustomerBookingFactReader = {
      getUsableOrRequestReconciliation: vi.fn(async () => ({ available: false })),
    };
    const server = createServer(
      repository,
      true,
      new SubmitBooking(areaResolver, bookingRepository, staleCustomerFacts)
    );

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/booking-submissions',
      headers: { authorization: 'Bearer test-token', 'idempotency-key': 'key-1' },
      payload: {
        rows: [{ areaId: 'la', customerId: '018f47a2-7b3c-7abc-8def-123456789abc' }],
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error).toMatchObject({
      code: 'CUSTOMER_STATUS_UNAVAILABLE',
      message: 'Current Customer status could not be verified.',
      retryable: true,
    });
    expect(response.json().error.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(bookingRepository.createSubmission).not.toHaveBeenCalled();
  });

  it('authenticates and authorizes Load reads in the Load-owned operation', async () => {
    const repository: LoadReadRepository = {
      findLoad: vi.fn(async () => ({
        authorization: { areaId: 'la', handlingBrokerPrincipalId: 'broker-1' },
        representation: loadRepresentation,
      })),
      findRevision: vi.fn(async () => null),
      findBookingSubmission: vi.fn(async () => null),
    };
    const server = createServer(repository);

    const unauthorized = await server.inject('/api/v1/loads/load-1');
    expect(unauthorized.statusCode).toBe(401);

    const response = await server.inject({
      url: '/api/v1/loads/load-1',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(loadRepresentation);
    expect(repository.findLoad).toHaveBeenCalledWith('load-1');
  });

  it('fails closed when the Identity verifier is not configured', async () => {
    const repository: LoadReadRepository = {
      findLoad: vi.fn(async () => null),
      findRevision: vi.fn(async () => null),
      findBookingSubmission: vi.fn(async () => null),
    };
    const server = createServer(repository, false);

    const response = await server.inject('/api/v1/loads/load-1');
    expect(response.statusCode).toBe(503);
    expect(repository.findLoad).not.toHaveBeenCalled();
  });

  it('verifies a signed token against issuer JWKS before authorizing a Load read', async () => {
    const issuer = 'https://identity.example.test';
    const audience = 'tms-api';
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'load-test-key';
    jwk.alg = 'RS256';
    jwk.use = 'sig';

    const jwksServer = createHttpServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise<void>((resolve) => jwksServer.listen(0, '127.0.0.1', resolve));
    const { port } = jwksServer.address() as AddressInfo;

    try {
      const verifier = createIdentityTokenVerifier({
        issuer,
        audience,
        jwksUri: `http://127.0.0.1:${port}/.well-known/jwks.json`,
        environment: 'test',
      });
      const now = Math.floor(Date.now() / 1000);
      const token = await new SignJWT({
        sid: 'session-1',
        auth_time: now,
        amr: ['pwd', 'otp'],
        grantVersion: 1,
        grants: [{ role: 'broker', scopeType: 'area', scopeId: 'la' }],
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'load-test-key' })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject('broker-1')
        .setJti('load-test-token')
        .setIssuedAt(now)
        .setExpirationTime(now + 60)
        .sign(privateKey);

      const repository: LoadReadRepository = {
        findLoad: vi.fn(async () => ({
          authorization: { areaId: 'la', handlingBrokerPrincipalId: 'broker-1' },
          representation: loadRepresentation,
        })),
        findRevision: vi.fn(async () => null),
        findBookingSubmission: vi.fn(async () => null),
      };
      const server = Fastify();
      servers.push(server);
      registerLoadRoutes(server, new LoadReads(repository), verifier);

      const response = await server.inject({
        url: '/api/v1/loads/load-1',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(loadRepresentation);

      const invalid = await server.inject({
        url: '/api/v1/loads/load-1',
        headers: { authorization: `Bearer ${token}x` },
      });
      expect(invalid.statusCode).toBe(401);
      expect(repository.findLoad).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        jwksServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('conceals an existing Load from a broker without handling authority', async () => {
    const repository: LoadReadRepository = {
      findLoad: vi.fn(async () => ({
        authorization: { areaId: 'la', handlingBrokerPrincipalId: 'broker-2' },
        representation: loadRepresentation,
      })),
      findRevision: vi.fn(async () => null),
      findBookingSubmission: vi.fn(async () => null),
    };
    const server = createServer(repository);

    const response = await server.inject({
      url: '/api/v1/loads/load-1',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: { code: 'LOAD_ACCESS_DENIED' },
    });
    expect(response.body).not.toContain('broker-2');
  });
});
