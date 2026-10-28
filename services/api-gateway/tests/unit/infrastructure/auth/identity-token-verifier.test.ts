import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { KeyLike } from 'jose';
import { createIdentityTokenVerifier } from '../../../../src/infrastructure/auth/identity-token-verifier';

describe('identity access-token verification', () => {
  const issuer = 'https://identity.example.test';
  const audience = 'tms-api';
  const privateServers: Array<ReturnType<typeof createHttpServer>> = [];
  let signingKey: KeyLike;
  let alternateSigningKey: KeyLike;
  let token: (
    claims?: Record<string, unknown>,
    options?: {
      alg?: string;
      kid?: string;
      issuer?: string;
      audience?: string;
      lifetimeSeconds?: number;
    }
  ) => Promise<string>;
  let verifier: ReturnType<typeof createIdentityTokenVerifier>;

  beforeEach(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    signingKey = privateKey;
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'identity-key-1';
    jwk.alg = 'RS256';
    jwk.use = 'sig';
    const alternatePair = await generateKeyPair('RS384');
    alternateSigningKey = alternatePair.privateKey;
    const alternateJwk = await exportJWK(alternatePair.publicKey);
    alternateJwk.kid = 'identity-key-384';
    alternateJwk.alg = 'RS384';
    alternateJwk.use = 'sig';

    const jwksServer = createHttpServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ keys: [jwk, alternateJwk] }));
    });
    privateServers.push(jwksServer);
    await new Promise<void>((resolve) => jwksServer.listen(0, '127.0.0.1', resolve));
    const { port } = jwksServer.address() as AddressInfo;

    verifier = createIdentityTokenVerifier({
      issuer,
      audience,
      jwksUri: `http://127.0.0.1:${port}/.well-known/jwks.json`,
    });

    token = async (claims = {}, options = {}) => {
      const now = Math.floor(Date.now() / 1000);
      const alg = options.alg ?? 'RS256';
      return new SignJWT({
        sid: 'session-1',
        auth_time: now,
        amr: ['pwd', 'otp'],
        grantVersion: 1,
        grants: [{ role: 'broker', scopeType: 'area', scopeId: 'west' }],
        ...claims,
      })
        .setProtectedHeader({
          alg,
          kid: options.kid ?? (alg === 'RS384' ? 'identity-key-384' : 'identity-key-1'),
        })
        .setIssuer(options.issuer ?? issuer)
        .setAudience(options.audience ?? audience)
        .setSubject('principal-1')
        .setJti('token-1')
        .setIssuedAt(now)
        .setExpirationTime(now + (options.lifetimeSeconds ?? 60))
        .sign(alg === 'RS384' ? alternateSigningKey : signingKey);
    };
  });

  afterEach(async () => {
    await Promise.all(
      privateServers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          })
      )
    );
  });

  it('accepts RS256 tokens with the required identity and grant claims', async () => {
    const claims = await verifier.verify(await token());

    expect(claims).toMatchObject({
      iss: issuer,
      aud: audience,
      sub: 'principal-1',
      sid: 'session-1',
      jti: 'token-1',
      grantVersion: 1,
      grants: [{ role: 'broker', scopeType: 'area', scopeId: 'west' }],
    });
  });

  it('rejects a token signed with an unconfigured algorithm', async () => {
    await expect(verifier.verify(await token({}, { alg: 'RS384' }))).rejects.toMatchObject({
      code: 'INVALID_ACCESS_TOKEN',
      statusCode: 401,
    });
  });

  it('rejects a token whose signing key is not published by the configured issuer', async () => {
    await expect(verifier.verify(await token({}, { kid: 'unknown-key' }))).rejects.toMatchObject({
      code: 'INVALID_ACCESS_TOKEN',
      statusCode: 401,
    });
  });

  it('rejects the wrong issuer and audience', async () => {
    await expect(
      verifier.verify(await token({}, { issuer: 'https://attacker.example.test' }))
    ).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN', statusCode: 401 });
    await expect(verifier.verify(await token({}, { audience: 'other-api' }))).rejects.toMatchObject(
      {
        code: 'INVALID_ACCESS_TOKEN',
        statusCode: 401,
      }
    );
  });

  it('rejects access tokens that outlive the 15-minute policy', async () => {
    await expect(
      verifier.verify(await token({}, { lifetimeSeconds: 16 * 60 }))
    ).rejects.toMatchObject({
      code: 'INVALID_ACCESS_TOKEN',
      statusCode: 401,
    });
  });

  it('rejects missing required claims and unapproved PII claims', async () => {
    await expect(
      verifier.verify(await token({ grants: undefined, email: 'person@example.test' }))
    ).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN', statusCode: 401 });
  });

  it('reports an unavailable JWKS endpoint as a retryable dependency failure', async () => {
    const unavailableVerifier = createIdentityTokenVerifier({
      issuer,
      audience,
      jwksUri: 'http://127.0.0.1:1/.well-known/jwks.json',
    });

    await expect(unavailableVerifier.verify(await token())).rejects.toMatchObject({
      code: 'IDENTITY_KEY_SET_UNAVAILABLE',
      statusCode: 503,
      retryable: true,
    });
  });
});
