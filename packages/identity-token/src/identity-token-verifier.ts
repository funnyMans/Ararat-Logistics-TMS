import { isIP } from 'node:net';
import { z } from 'zod';
import { createRemoteJWKSet, customFetch, errors, jwtVerify } from 'jose';

const identityGrantSchema = z
  .object({
    role: z.string().min(1).max(128),
    scopeType: z.string().min(1).max(128),
    scopeId: z.string().max(256).nullable(),
  })
  .strict();

const identityTokenClaimsSchema = z
  .object({
    iss: z.string().url(),
    aud: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
    sub: z.string().min(1).max(256),
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
    jti: z.string().min(1).max(256),
    sid: z.string().min(1).max(256),
    auth_time: z.number().int().nonnegative(),
    amr: z.array(z.string().min(1).max(64)).min(1).max(16),
    grantVersion: z.number().int().positive().safe(),
    grants: z.array(identityGrantSchema).max(256),
  })
  .strict();

export type IdentityTokenClaims = z.infer<typeof identityTokenClaimsSchema>;

export class IdentityTokenVerificationError extends Error {
  readonly code = 'INVALID_ACCESS_TOKEN';
  readonly statusCode = 401;
  readonly retryable = false;

  constructor() {
    super('****** is missing, invalid, or expired.');
    this.name = 'IdentityTokenVerificationError';
  }
}

export class IdentityProviderUnavailableError extends Error {
  readonly code = 'IDENTITY_KEY_SET_UNAVAILABLE';
  readonly statusCode = 503;
  readonly retryable = true;

  constructor(cause?: unknown) {
    super('Identity signing keys are temporarily unavailable.', { cause });
    this.name = 'IdentityProviderUnavailableError';
  }
}

export type IdentityTokenVerifierOptions = {
  issuer: string;
  audience: string;
  jwksUri: string;
  environment: 'development' | 'test' | 'production';
};

function isLoopbackHostname(hostname: string): boolean {
  const address =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  if (address.toLowerCase() === 'localhost') {
    return true;
  }

  const ipVersion = isIP(address);
  return (
    (ipVersion === 4 && Number(address.split('.')[0]) === 127) ||
    (ipVersion === 6 && address === '::1')
  );
}

export function createIdentityTokenVerifier({
  issuer,
  audience,
  jwksUri,
  environment,
}: IdentityTokenVerifierOptions): {
  verify: (token: string) => Promise<IdentityTokenClaims>;
} {
  const jwksUrl = new URL(jwksUri);
  const isTestLoopbackHttp =
    environment === 'test' && jwksUrl.protocol === 'http:' && isLoopbackHostname(jwksUrl.hostname);
  if (jwksUrl.protocol !== 'https:' && !isTestLoopbackHttp) {
    throw new Error(
      'IDENTITY_JWKS_URI must use HTTPS except for loopback HTTP in the test environment.'
    );
  }

  const jwks = createRemoteJWKSet(jwksUrl, {
    cacheMaxAge: 5 * 60 * 1000,
    [customFetch]: async (input, init) => {
      try {
        return await fetch(input, init);
      } catch (cause) {
        throw new IdentityProviderUnavailableError(cause);
      }
    },
  });

  return {
    async verify(token) {
      let payload: Record<string, unknown>;

      try {
        ({ payload } = await jwtVerify(token, jwks, {
          algorithms: ['RS256'],
          audience,
          issuer,
          clockTolerance: 5,
        }));
      } catch (error) {
        if (error instanceof IdentityProviderUnavailableError) {
          throw error;
        }

        if (error instanceof errors.JOSEError) {
          if (error.code.startsWith('ERR_JWKS_') && error.code !== 'ERR_JWKS_NO_MATCHING_KEY') {
            throw new IdentityProviderUnavailableError(error);
          }
          throw new IdentityTokenVerificationError();
        }

        throw error;
      }

      const parsed = identityTokenClaimsSchema.safeParse(payload);
      if (!parsed.success) {
        throw new IdentityTokenVerificationError();
      }

      const now = Math.floor(Date.now() / 1000);
      if (
        parsed.data.exp <= parsed.data.iat ||
        parsed.data.exp - parsed.data.iat > 15 * 60 ||
        parsed.data.iat > now + 5 ||
        parsed.data.auth_time > parsed.data.iat + 5
      ) {
        throw new IdentityTokenVerificationError();
      }

      return parsed.data;
    },
  };
}
