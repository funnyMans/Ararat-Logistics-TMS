import type { FastifyInstance } from 'fastify';
import type { IdentityTokenClaims } from '@app/identity-token';
import { LoadReads } from '../../application/queries/load-reads';
import type { SubmitBooking } from '../../application/commands/submit-booking';
import { createLoadIdentityVerifier } from '../../infrastructure/identity/create-load-identity-verifier';
import { registerIdentityAuthentication } from './hooks/identity-authentication';
import { registerLoadReadRoutes } from './routes/loads';

type TokenVerifier = {
  verify: (token: string) => Promise<IdentityTokenClaims>;
};

export function registerLoadRoutes(
  server: FastifyInstance,
  reads: LoadReads,
  verifier: TokenVerifier | undefined = createLoadIdentityVerifier(),
  submitBooking?: SubmitBooking
): void {
  registerIdentityAuthentication(server, verifier);
  registerLoadReadRoutes(server, reads, submitBooking);
}
