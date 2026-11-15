import { connect } from 'amqplib';
import type { Channel, ChannelModel, ConfirmChannel } from 'amqplib';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { CapacityCommandConsumer } from './infrastructure/messaging/capacity-command-consumer';
import { CapacityHoldExpiryWorker } from './infrastructure/messaging/capacity-hold-expiry-worker';
import { CapacityOutboxWorker } from './infrastructure/messaging/capacity-outbox-worker';
import { RabbitCapacityOutboxPublisher } from './infrastructure/messaging/rabbit-capacity-outbox-publisher';
import { PostgresCapacityCommitmentRepository } from './infrastructure/persistence/postgres-capacity-commitment-repository';
import { readCapacityRuntimeConfig } from './infrastructure/config/runtime-config';
import {
  createCapacityHealthServer,
  type CapacityRuntimeHealth,
} from './infrastructure/http/capacity-health-server';

function log(level: 'info' | 'error', message: string, error?: unknown): void {
  console[level](
    JSON.stringify({
      level,
      service: 'capacity-commitment',
      message,
      ...(error === undefined
        ? {}
        : {
            error:
              error instanceof Error ? { name: error.name, message: error.message } : String(error),
          }),
    })
  );
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function run(): Promise<void> {
  const config = readCapacityRuntimeConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 5_000,
    statement_timeout: 5_000,
  });
  const health: CapacityRuntimeHealth = {
    startupComplete: false,
    brokerConnected: false,
    outboxWorkerErrors: 0,
    holdExpiryWorkerErrors: 0,
    commandConsumerErrors: 0,
  };
  const repository = new PostgresCapacityCommitmentRepository(pool);
  let connection: ChannelModel | undefined;
  let commandChannel: Channel | undefined;
  let publisherChannel: ConfirmChannel | undefined;
  let commandConsumerTag: string | undefined;
  let outboxWorker: CapacityOutboxWorker | undefined;
  let holdExpiryWorker: CapacityHoldExpiryWorker | undefined;
  let healthServer: Server | undefined;
  let shutdownPromise: Promise<void> | undefined;

  const shutdown = (exitCode = 0): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }
    health.startupComplete = false;
    shutdownPromise = (async () => {
      const cleanups: Array<[string, () => Promise<unknown>]> = [];
      if (commandChannel && commandConsumerTag) {
        cleanups.push([
          'cancel command consumer',
          () => commandChannel!.cancel(commandConsumerTag!),
        ]);
      }
      if (outboxWorker) {
        cleanups.push(['stop outbox worker', () => outboxWorker!.stop()]);
      }
      if (holdExpiryWorker) {
        cleanups.push(['stop hold-expiry worker', () => holdExpiryWorker!.stop()]);
      }
      if (healthServer?.listening) {
        cleanups.push(['close health server', () => closeServer(healthServer!)]);
      }
      if (commandChannel) {
        cleanups.push(['close command channel', () => commandChannel!.close()]);
      }
      if (publisherChannel) {
        cleanups.push(['close publisher channel', () => publisherChannel!.close()]);
      }
      if (connection) {
        cleanups.push(['close RabbitMQ connection', () => connection!.close()]);
      }
      cleanups.push(['close PostgreSQL pool', () => pool.end()]);

      const results = await Promise.allSettled(cleanups.map(([, cleanup]) => cleanup()));
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          log(
            'error',
            `Failed to ${cleanups[index]?.[0] ?? 'clean up runtime resource'}.`,
            result.reason
          );
          exitCode = 1;
        }
      });
      process.exitCode = exitCode;
    })();
    return shutdownPromise;
  };

  try {
    pool.on('error', (error: Error) => log('error', 'Unexpected PostgreSQL pool error.', error));
    await pool.query('SELECT 1');
    const schema = await pool.query<{ reservations: string | null }>(
      `SELECT to_regclass('reservations') AS reservations`
    );
    if (!schema.rows[0]?.reservations) {
      throw new Error('Capacity Commitment migrations have not been applied.');
    }

    const rabbitConnection = await connect(config.amqpUrl);
    connection = rabbitConnection;
    health.brokerConnected = true;
    rabbitConnection.on('error', (error: Error) =>
      log('error', 'RabbitMQ connection error.', error)
    );
    rabbitConnection.once('close', () => {
      health.brokerConnected = false;
      if (!shutdownPromise) {
        log('error', 'RabbitMQ connection closed unexpectedly; shutting down for restart.');
        void shutdown(1);
      }
    });
    const consumingChannel = await rabbitConnection.createChannel();
    commandChannel = consumingChannel;
    const confirmingChannel = await rabbitConnection.createConfirmChannel();
    publisherChannel = confirmingChannel;
    consumingChannel.on('error', (error: Error) =>
      log('error', 'Capacity command channel error.', error)
    );
    confirmingChannel.on('error', (error: Error) =>
      log('error', 'Capacity publisher channel error.', error)
    );
    for (const [channelName, channel] of [
      ['command', consumingChannel],
      ['publisher', confirmingChannel],
    ] as const) {
      channel.once('close', () => {
        if (!shutdownPromise) {
          log('error', `Capacity ${channelName} channel closed unexpectedly; shutting down.`);
          void shutdown(1);
        }
      });
    }
    const consumer = new CapacityCommandConsumer(repository, (error, messageId) => {
      health.commandConsumerErrors += 1;
      log('error', `Capacity command failed${messageId ? ` (${messageId})` : ''}.`, error);
    });
    commandConsumerTag = await consumer.start(consumingChannel, config.commandQueue);
    const publisher = new RabbitCapacityOutboxPublisher(confirmingChannel, config.outcomeExchange);
    outboxWorker = new CapacityOutboxWorker(
      repository,
      publisher,
      (error) => {
        health.outboxWorkerErrors += 1;
        log('error', 'Capacity outbox worker failed; pending outcomes remain durable.', error);
      },
      config.workerPollIntervalMs
    );
    holdExpiryWorker = new CapacityHoldExpiryWorker(
      repository,
      (error) => {
        health.holdExpiryWorkerErrors += 1;
        log('error', 'Capacity hold-expiry worker failed.', error);
      },
      config.workerPollIntervalMs
    );
    outboxWorker.start();
    holdExpiryWorker.start();

    healthServer = createCapacityHealthServer(pool, health);
    await listen(healthServer, config.port, config.host);
    health.startupComplete = true;
    process.once('SIGTERM', () => void shutdown());
    process.once('SIGINT', () => void shutdown());
    log('info', `Capacity Commitment runtime listening on ${config.host}:${config.port}.`);
  } catch (error) {
    await shutdown(1);
    throw error;
  }
}

void run().catch((error: unknown) => {
  log('error', 'Capacity Commitment runtime failed to start.', error);
  process.exitCode = 1;
});
