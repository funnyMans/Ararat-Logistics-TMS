import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerHealthRoutes } from '../../../../../src/interfaces/http/routes/health';

describe('api gateway health routes', () => {
  const servers: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
    vi.unstubAllGlobals();
  });

  function createServer() {
    const server = Fastify();
    servers.push(server);
    registerHealthRoutes(server);
    return server;
  }

  it('reports the gateway as ready without downstream dependencies', async () => {
    const server = createServer();

    const response = await server.inject('/ready');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ready: true });
  });

  it('reports health without dependencies', async () => {
    const server = createServer();

    const response = await server.inject('/health');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: 'api-gateway',
      status: 'ok',
      dependencies: {},
    });
  });
});
