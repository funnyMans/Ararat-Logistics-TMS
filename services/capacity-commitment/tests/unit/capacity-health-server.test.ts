import { createServer } from 'node:http';
import { Pool } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createCapacityHealthServer,
  type CapacityRuntimeHealth,
} from '../../src/infrastructure/http/capacity-health-server';

describe('Capacity Commitment health endpoints', () => {
  let server: ReturnType<typeof createServer> | undefined;
  let pool: Pool | undefined;

  afterEach(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => (error ? reject(error) : resolve()));
      });
    }
    server = undefined;
    await pool?.end();
    pool = undefined;
  });

  it('reports process health independently and fails readiness when PostgreSQL is unavailable', async () => {
    pool = new Pool({
      host: '127.0.0.1',
      port: 1,
      user: 'capacity_test',
      database: 'capacity_test',
      connectionTimeoutMillis: 100,
      query_timeout: 200,
    });
    const health: CapacityRuntimeHealth = {
      startupComplete: true,
      brokerConnected: true,
      outboxWorkerErrors: 0,
      holdExpiryWorkerErrors: 0,
      commandConsumerErrors: 0,
    };
    server = createCapacityHealthServer(pool, health);
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject);
      server!.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Health server did not bind to a TCP port.');
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const healthResponse = await fetch(`${baseUrl}/health`);
    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.json()).toEqual({ status: 'ok' });

    const readinessResponse = await fetch(`${baseUrl}/ready`);
    expect(readinessResponse.status).toBe(503);
    expect(await readinessResponse.json()).toMatchObject({
      ready: false,
      database: 'unavailable',
    });
  });

  it('rejects unsupported methods and reports unknown routes', async () => {
    pool = new Pool();
    const health: CapacityRuntimeHealth = {
      startupComplete: false,
      brokerConnected: false,
      outboxWorkerErrors: 0,
      holdExpiryWorkerErrors: 0,
      commandConsumerErrors: 0,
    };
    server = createCapacityHealthServer(pool, health);
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject);
      server!.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Health server did not bind to a TCP port.');
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    expect((await fetch(baseUrl, { method: 'POST' })).status).toBe(405);
    expect((await fetch(`${baseUrl}/unknown`)).status).toBe(404);
  });
});
