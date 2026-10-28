import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  IdentityProviderUnavailableError,
  IdentityTokenVerificationError,
} from '../../../infrastructure/auth/identity-token-verifier';
import type { IdentityTokenClaims } from '../../../infrastructure/auth/identity-token-verifier';

declare module 'fastify' {
  interface FastifyRequest {
    identity?: IdentityTokenClaims;
  }
}

type TokenVerifier = {
  verify: (token: string) => Promise<IdentityTokenClaims>;
};

const publicRoutePaths = new Set(['/health', '/ready', '/metrics']);

function sendAuthenticationError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  retryable: boolean
) {
  return reply.status(statusCode).send({
    error: {
      code,
      message,
      retryable,
      requestId: request.id,
    },
  });
}

export function registerIdentityAuthentication(
  server: FastifyInstance,
  verifier: TokenVerifier | undefined
): void {
  server.addHook('preHandler', async (request, reply) => {
    if (publicRoutePaths.has(request.routeOptions.url ?? '')) {
      return;
    }

    if (!verifier) {
      request.log.error(
        { requestId: request.id, route: request.routeOptions.url },
        'identity token verification is not configured'
      );
      return sendAuthenticationError(
        request,
        reply,
        503,
        'IDENTITY_AUTHENTICATION_UNAVAILABLE',
        'Authentication is temporarily unavailable.',
        true
      );
    }

    const authorization = request.headers.authorization;
    const match =
      typeof authorization === 'string' ? /^Bearer ([^\s]+)$/.exec(authorization) : null;
    if (!match) {
      return sendAuthenticationError(
        request,
        reply,
        401,
        'AUTHENTICATION_REQUIRED',
        'A valid bearer token is required.',
        false
      );
    }

    try {
      request.identity = await verifier.verify(match[1]);
    } catch (error) {
      if (error instanceof IdentityTokenVerificationError) {
        return sendAuthenticationError(
          request,
          reply,
          error.statusCode,
          error.code,
          error.message,
          error.retryable
        );
      }

      if (error instanceof IdentityProviderUnavailableError) {
        request.log.error(
          { code: error.code, requestId: request.id },
          'identity key set unavailable'
        );
        return sendAuthenticationError(
          request,
          reply,
          error.statusCode,
          error.code,
          error.message,
          error.retryable
        );
      }

      throw error;
    }
  });
}
