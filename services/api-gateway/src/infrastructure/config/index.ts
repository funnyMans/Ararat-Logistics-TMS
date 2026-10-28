import 'dotenv/config';
import { z } from 'zod';
import { createConfig } from '@app/common';

export const config = createConfig({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.string().default('info'),
  IDENTITY_ISSUER: z.string().url().optional(),
  IDENTITY_AUDIENCE: z.string().min(1).optional(),
  IDENTITY_JWKS_URI: z.string().url().optional(),
});

const identityVerifierSettings = [
  config.IDENTITY_ISSUER,
  config.IDENTITY_AUDIENCE,
  config.IDENTITY_JWKS_URI,
];

if (identityVerifierSettings.some(Boolean) && !identityVerifierSettings.every(Boolean)) {
  throw new Error(
    'IDENTITY_ISSUER, IDENTITY_AUDIENCE, and IDENTITY_JWKS_URI must be configured together.'
  );
}
