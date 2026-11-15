import { randomUUIDv7 } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { connect } from 'amqplib';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { describe, expect, it } from 'vitest';
import { capacityCommitmentCommandSchema } from '../../src/interfaces/messaging/capacity-commitment-messages';
import {
  CAPACITY_COMMAND_EXCHANGE,
  CAPACITY_OUTCOME_EXCHANGE,
  CAPACITY_OUTCOME_ROUTING_KEYS,
  CAPACITY_RABBITMQ_VHOST,
} from '../../src/infrastructure/messaging/capacity-topology';

const runtimeIntegration =
  process.env.CAPACITY_COMMITMENT_RUNTIME_INTEGRATION === '1' ? describe : describe.skip;
const composeArgs = [
  'compose',
  '--profile',
  'capacity-commitment',
  '-f',
  'infra/docker-compose.dev.yml',
];

function runCompose(...args: string[]): string {
  return execFileSync('docker', [...composeArgs, ...args], {
    encoding: 'utf8',
    timeout: 45_000,
  }).trim();
}

function connectionUrl(credentials: { username: string; password: string }, hostPort: string): URL {
  const url = new URL('amqp://localhost');
  url.username = credentials.username;
  url.password = credentials.password;
  url.hostname = '127.0.0.1';
  url.port = hostPort;
  url.pathname = `/${CAPACITY_RABBITMQ_VHOST}`;
  return url;
}

function makeReserveCommand() {
  const powerUnitId = randomUUIDv7();
  const trailerId = randomUUIDv7();
  const driverId = randomUUIDv7();
  const messageId = randomUUIDv7();
  const tripPlanId = randomUUIDv7();
  const command = capacityCommitmentCommandSchema.parse({
    messageId,
    messageType: 'capacity.reservation.reserve',
    schemaVersion: '1.0.0',
    sourceService: 'dispatch-planning',
    targetService: 'capacity-commitment',
    issuedAt: new Date().toISOString(),
    correlationId: randomUUIDv7(),
    commandId: randomUUIDv7(),
    idempotencyKey: `runtime-integration:${randomUUIDv7()}`,
    payload: {
      planningAttemptId: randomUUIDv7(),
      tripPlanId,
      tripPlanRevision: 1,
      segments: [
        {
          sequenceNumber: 1,
          startStopId: randomUUIDv7(),
          endStopId: randomUUIDv7(),
          timeWindow: {
            startAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            endAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          },
          powerUnitId,
          trailerId,
          driverIds: [driverId],
          resourceReadinessRevisions: [
            { resourceType: 'POWER_UNIT', resourceId: powerUnitId, ownerRevision: 1 },
            { resourceType: 'TRAILER', resourceId: trailerId, ownerRevision: 1 },
            { resourceType: 'DRIVER', resourceId: driverId, ownerRevision: 1 },
          ],
        },
      ],
    },
  });
  return command;
}

runtimeIntegration('Capacity Commitment runtime', () => {
  it('consumes a durable command and publishes its outcome through the restricted runtime service', async () => {
    const brokerCredentials = runCompose(
      'exec',
      '-T',
      'capacity-commitment-rabbitmq',
      'sh',
      '-c',
      'printf "%s|%s" "$RABBITMQ_DEFAULT_USER" "$RABBITMQ_DEFAULT_PASS"'
    ).split('|');
    const [adminUser, adminPassword] = brokerCredentials;
    if (!adminUser || !adminPassword) {
      throw new Error('Could not read the local Capacity Commitment broker credentials.');
    }

    const runtimeAmqpUrl = runCompose(
      'exec',
      '-T',
      'capacity-commitment',
      'sh',
      '-c',
      'printf "%s" "$CAPACITY_AMQP_URL"'
    );
    const runtimeUrl = new URL(runtimeAmqpUrl);
    const hostBinding = runCompose('port', 'capacity-commitment-rabbitmq', '5672');
    const hostPort = hostBinding.split(':').at(-1);
    if (!hostPort) {
      throw new Error('Could not determine the local Capacity Commitment broker port.');
    }

    const adminUrl = connectionUrl({ username: adminUser, password: adminPassword }, hostPort);
    const adminConnection = await connect(adminUrl.toString());
    let channel: ConfirmChannel | undefined;
    let consumerTag: string | undefined;
    let timeout: NodeJS.Timeout | undefined;
    try {
      channel = await adminConnection.createConfirmChannel();
      const queue = await channel.assertQueue('', { exclusive: true, autoDelete: true });
      for (const routingKey of CAPACITY_OUTCOME_ROUTING_KEYS) {
        await channel.bindQueue(queue.queue, CAPACITY_OUTCOME_EXCHANGE, routingKey);
      }

      const command = makeReserveCommand();
      let resolveOutcome: (outcome: Record<string, unknown>) => void = () => undefined;
      let rejectOutcome: (error: Error) => void = () => undefined;
      const outcomePromise = new Promise<Record<string, unknown>>((resolve, reject) => {
        resolveOutcome = resolve;
        rejectOutcome = reject;
      });
      timeout = setTimeout(
        () => rejectOutcome(new Error('Timed out waiting for Capacity Commitment outcome.')),
        15_000
      );
      const consumer = await channel.consume(
        queue.queue,
        (message: ConsumeMessage | null) => {
          if (!message) {
            return;
          }
          try {
            const outcome = JSON.parse(message.content.toString('utf8')) as Record<string, unknown>;
            channel!.ack(message);
            if (outcome.causationId === command.messageId) {
              resolveOutcome(outcome);
            }
          } catch (error) {
            channel!.nack(message, false, false);
            rejectOutcome(error instanceof Error ? error : new Error(String(error)));
          }
        },
        { noAck: false }
      );
      consumerTag = consumer.consumerTag;

      channel.publish(
        CAPACITY_COMMAND_EXCHANGE,
        'capacity.reservation.reserve.v1',
        Buffer.from(JSON.stringify(command)),
        {
          contentType: 'application/json',
          deliveryMode: 2,
          messageId: command.messageId,
          type: command.messageType,
          timestamp: Date.now(),
        }
      );
      await channel.waitForConfirms();
      const outcome = await outcomePromise;
      clearTimeout(timeout);
      timeout = undefined;
      expect(outcome).toMatchObject({
        messageType: 'capacity.reservation.reserve.outcome',
        causationId: command.messageId,
        targetService: 'dispatch-planning',
        payload: { outcome: 'RESERVED' },
      });

      const appCredentialsUrl = runtimeUrl;
      appCredentialsUrl.hostname = '127.0.0.1';
      appCredentialsUrl.port = hostPort;
      const appConnection = await connect(appCredentialsUrl.toString());
      try {
        const permissionChannel = await appConnection.createConfirmChannel();
        const permissionDenied = new Promise<Error>((resolve, reject) => {
          const permissionTimeout = setTimeout(
            () => reject(new Error('Capacity runtime unexpectedly wrote to the command exchange.')),
            3_000
          );
          permissionChannel.once('error', (error: Error) => {
            clearTimeout(permissionTimeout);
            resolve(error);
          });
        });
        permissionChannel.publish(
          CAPACITY_COMMAND_EXCHANGE,
          'capacity.reservation.reserve.v1',
          Buffer.from('{}')
        );
        const permissionError = await permissionDenied;
        expect(permissionError.message).toMatch(/ACCESS[_-]REFUSED/i);
      } finally {
        await appConnection.close();
      }
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (consumerTag && channel) {
        await channel.cancel(consumerTag);
      }
      await channel?.close();
      await adminConnection.close();
    }
  }, 30_000);
});
