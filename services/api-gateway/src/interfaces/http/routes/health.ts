import type { FastifyInstance } from 'fastify';
import { buildHealthReport } from '@app/common';

export function registerHealthRoutes(server: FastifyInstance) {
  server.get('/health', async () => {
    return buildHealthReport('api-gateway', {});
  });

  server.get('/ready', async (_request, reply) => {
    return reply.status(200).send({ ready: true });
  });
}
