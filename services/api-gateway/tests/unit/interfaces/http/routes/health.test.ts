import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerHealthRoutes } from '../../../../../src/interfaces/http/routes/health';

describe('api gateway health routes', () => {
  const servers: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
    vi.unstubAllGlobals();
  });

  function createServer(isReady?: () => boolean) {
    const server = Fastify();
    servers.push(server);
    registerHealthRoutes(server, isReady);
    return server;
  }

  it('reports not-ready until the service is accepting work', async () => {
    let ready = false;
    const server = createServer(() => ready);

    const startingResponse = await server.inject('/ready');
    expect(startingResponse.statusCode).toBe(503);
    expect(startingResponse.json()).toEqual({ ready: false });

    ready = true;
    const readyResponse = await server.inject('/ready');
    expect(readyResponse.statusCode).toBe(200);
    expect(readyResponse.json()).toEqual({ ready: true });

    ready = false;
    const drainingResponse = await server.inject('/ready');
    expect(drainingResponse.statusCode).toBe(503);
    expect(drainingResponse.json()).toEqual({ ready: false });
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
