import { createServer, type Server } from 'node:http';
import type { Pool } from 'pg';

export interface CapacityRuntimeHealth {
  startupComplete: boolean;
  brokerConnected: boolean;
  outboxWorkerErrors: number;
  holdExpiryWorkerErrors: number;
  commandConsumerErrors: number;
}

export function createCapacityHealthServer(
  pool: Pool,
  health: CapacityRuntimeHealth,
  startedAt = Date.now()
): Server {
  return createServer((request, response) => {
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' });
      response.end();
      return;
    }

    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (request.url === '/metrics') {
      void pool.query('SELECT 1').then(
        () => {
          response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' });
          response.end(
            [
              '# HELP capacity_commitment_up Whether the Capacity Commitment process is running.',
              '# TYPE capacity_commitment_up gauge',
              'capacity_commitment_up 1',
              '# HELP capacity_commitment_ready Whether startup and required dependencies are ready.',
              '# TYPE capacity_commitment_ready gauge',
              `capacity_commitment_ready ${health.startupComplete && health.brokerConnected ? 1 : 0}`,
              '# HELP capacity_commitment_database_up Whether PostgreSQL accepts a health query.',
              '# TYPE capacity_commitment_database_up gauge',
              'capacity_commitment_database_up 1',
              '# HELP capacity_commitment_worker_errors_total Errors surfaced by background workers.',
              '# TYPE capacity_commitment_worker_errors_total counter',
              `capacity_commitment_worker_errors_total{worker="outbox"} ${health.outboxWorkerErrors}`,
              `capacity_commitment_worker_errors_total{worker="hold_expiry"} ${health.holdExpiryWorkerErrors}`,
              `capacity_commitment_worker_errors_total{worker="command_consumer"} ${health.commandConsumerErrors}`,
              '# HELP capacity_commitment_process_start_time_seconds Unix time when the process started.',
              '# TYPE capacity_commitment_process_start_time_seconds gauge',
              `capacity_commitment_process_start_time_seconds ${Math.floor(startedAt / 1000)}`,
              '',
            ].join('\n')
          );
        },
        (error: unknown) => {
          console.error('Capacity Commitment metrics database probe failed.', error);
          response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
          response.end('metrics unavailable\n');
        }
      );
      return;
    }

    if (request.url === '/ready') {
      void pool.query('SELECT 1').then(
        () => {
          const ready = health.startupComplete && health.brokerConnected;
          response.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({
              ready,
              database: 'ok',
              broker: health.brokerConnected ? 'ok' : 'unavailable',
              startupComplete: health.startupComplete,
            })
          );
        },
        (error: unknown) => {
          console.error('Capacity Commitment readiness database probe failed.', error);
          response.writeHead(503, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({
              ready: false,
              database: 'unavailable',
              broker: health.brokerConnected ? 'ok' : 'unavailable',
              startupComplete: health.startupComplete,
            })
          );
        }
      );
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not_found' }));
  });
}
