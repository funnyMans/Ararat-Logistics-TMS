import type { FastifyInstance } from 'fastify';
import { buildHealthReport } from '@app/common';

export function registerHealthRoutes(server: FastifyInstance, isReady: () => boolean = () => true) {
  server.get('/health', async () => {
    return buildHealthReport('api-gateway', {});
  });

  server.get('/ready', async (_request, reply) => {
    const ready = isReady();
    return reply.status(ready ? 200 : 503).send({ ready });
  });
}
