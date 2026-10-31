import { z } from 'zod';
import { createConfig } from '@app/common';
import { createIdentityTokenVerifier } from '@app/identity-token';

const config = createConfig({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  IDENTITY_ISSUER: z.string().url().optional(),
  IDENTITY_AUDIENCE: z.string().min(1).optional(),
  IDENTITY_JWKS_URI: z.string().url().optional(),
});

const verifierSettings = [
  config.IDENTITY_ISSUER,
  config.IDENTITY_AUDIENCE,
  config.IDENTITY_JWKS_URI,
];

if (verifierSettings.some(Boolean) && !verifierSettings.every(Boolean)) {
  throw new Error(
    'IDENTITY_ISSUER, IDENTITY_AUDIENCE, and IDENTITY_JWKS_URI must be configured together.'
  );
}

export function createLoadIdentityVerifier() {
  if (!config.IDENTITY_ISSUER || !config.IDENTITY_AUDIENCE || !config.IDENTITY_JWKS_URI) {
    return undefined;
  }

  return createIdentityTokenVerifier({
    issuer: config.IDENTITY_ISSUER,
    audience: config.IDENTITY_AUDIENCE,
    jwksUri: config.IDENTITY_JWKS_URI,
    environment: config.NODE_ENV,
  });
}
