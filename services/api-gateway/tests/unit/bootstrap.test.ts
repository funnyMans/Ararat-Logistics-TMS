import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@app/common')>();
  return {
    ...actual,
    createServiceBootstrap: () => ({
      shutdown: async () => {},
    }),
  };
});

import { createServer } from '../../src/bootstrap';

describe('api gateway lifecycle', () => {
  const instances: Array<ReturnType<typeof createServer>> = [];

  afterEach(async () => {
    await Promise.all(
      instances.splice(0).map(async ({ server, shutdown }) => {
        await shutdown();
        await server.close();
      })
    );
  });

  it('is not ready before startup or after shutdown begins', async () => {
    const instance = createServer();
    instances.push(instance);

    const beforeStartup = await instance.server.inject('/ready');
    expect(beforeStartup.statusCode).toBe(503);
    expect(beforeStartup.json()).toEqual({ ready: false });

    instance.markReady();
    const duringService = await instance.server.inject('/ready');
    expect(duringService.statusCode).toBe(200);
    expect(duringService.json()).toEqual({ ready: true });

    await instance.shutdown();
    const duringShutdown = await instance.server.inject('/ready');
    expect(duringShutdown.statusCode).toBe(503);
    expect(duringShutdown.json()).toEqual({ ready: false });
  });
});
