import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import * as amqp from 'amqplib';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { describe, expect, it } from 'vitest';

const messagingIntegration = process.env.RABBITMQ_INTEGRATION === '1' ? describe : describe.skip;
const composeArgs = ['compose', '-f', 'infra/docker-compose.dev.yml'];
const exchange = 'foundation.conformance';
const routingKey = 'foundation.conformance.probe.v1';
const messageId = randomUUID();
const unroutableMessageId = randomUUID();
const unroutableRoutingKey = 'foundation.conformance.unbound.v1';
const queue = `foundation.conformance.delivery.v1.${messageId.replaceAll('-', '')}`;

function runCompose(...args: string[]): string {
  return execFileSync('docker', [...composeArgs, ...args], {
    encoding: 'utf8',
    timeout: 45_000,
  }).trim();
}

function queryPostgres(sql: string): string {
  return execFileSync(
    'docker',
    [
      ...composeArgs,
      'exec',
      '-T',
      'postgres',
      'sh',
      '-c',
      'exec psql --no-psqlrc --quiet --set ON_ERROR_STOP=1 --tuples-only --no-align --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --command "$1"',
      'messaging-conformance',
      sql,
    ],
    {
      encoding: 'utf8',
      timeout: 10_000,
    }
  ).trim();
}

async function waitForPostgres(): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      if (queryPostgres('SELECT 1') === '1') {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  throw new Error('PostgreSQL did not become available.', { cause: lastError });
}

async function waitForRabbitMQ(): Promise<void> {
  const deadline = Date.now() + 45_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const connection = await connectToRabbitMQ();
      await connection.close();
      return;
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  }

  throw new Error('RabbitMQ did not become available after restart.', { cause: lastError });
}

async function connectToRabbitMQ(url?: string): Promise<amqp.ChannelModel> {
  if (url) {
    return amqp.connect(url, { timeout: 2_000 });
  }

  const binding = runCompose('port', 'rabbitmq', '5672');
  const hostPort = binding.split(':').at(-1);
  if (!hostPort) {
    throw new Error(`Could not determine RabbitMQ's published host port from "${binding}".`);
  }

  return amqp.connect(`amqp://foundation_test:foundation_test@127.0.0.1:${hostPort}`, {
    timeout: 2_000,
  });
}

async function declareDurableTestRoute(channel: ConfirmChannel): Promise<void> {
  await channel.assertExchange(exchange, 'topic', { durable: true, autoDelete: false });
  await channel.assertQueue(queue, { durable: true, exclusive: false, autoDelete: false });
  await channel.bindQueue(queue, exchange, routingKey);
}

function messageEnvelope(id = messageId): string {
  return JSON.stringify({
    messageId: id,
    schemaVersion: '1.0.0',
    type: 'foundation.conformance.probe',
    payload: { value: 'committed-test-outbox-item' },
  });
}

async function publishConfirmed(
  channel: ConfirmChannel,
  payload: string,
  route = routingKey,
  id = messageId
): Promise<boolean> {
  let returnedMessage: string | undefined;
  const onReturn = (message: ConsumeMessage) => {
    returnedMessage = message.fields.routingKey;
  };
  channel.on('return', onReturn);

  try {
    channel.publish(exchange, route, Buffer.from(payload), {
      contentType: 'application/json',
      deliveryMode: 2,
      mandatory: true,
      messageId: id,
      timestamp: Date.now(),
      type: 'foundation.conformance.probe.v1',
    });
    await channel.waitForConfirms();

    return returnedMessage === undefined;
  } finally {
    channel.off('return', onReturn);
  }
}

interface TestOutboxItem {
  routingKey: string;
  payload: { messageId: string; [key: string]: unknown };
}

function readOutboxItem(id = messageId): TestOutboxItem {
  return JSON.parse(
    queryPostgres(`
      SELECT json_build_object('routingKey', routing_key, 'payload', payload)::text
      FROM foundation_conformance.messaging_outbox
      WHERE message_id = '${id}' AND state = 'pending';
    `)
  ) as TestOutboxItem;
}

function createTestTables(): void {
  queryPostgres(`
    CREATE SCHEMA IF NOT EXISTS foundation_conformance;
    CREATE TABLE IF NOT EXISTS foundation_conformance.messaging_outbox (
      message_id uuid PRIMARY KEY,
      routing_key text NOT NULL,
      payload jsonb NOT NULL,
      state text NOT NULL CHECK (state IN ('pending', 'published', 'parked')),
      topology_error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      published_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS foundation_conformance.messaging_inbox (
      message_id uuid PRIMARY KEY,
      payload jsonb NOT NULL,
      received_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS foundation_conformance.messaging_side_effect (
      message_id uuid PRIMARY KEY REFERENCES foundation_conformance.messaging_inbox (message_id),
      effect_value text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE foundation_conformance.messaging_outbox
      ADD COLUMN IF NOT EXISTS topology_error text;
  `);
}

function commitOutboxItem(id = messageId, route = routingKey, payload = messageEnvelope(id)): void {
  queryPostgres(`
    INSERT INTO foundation_conformance.messaging_outbox (message_id, routing_key, payload, state)
    VALUES (
      '${id}',
      '${route}',
      '${payload.replaceAll("'", "''")}'::jsonb,
      'pending'
    )
    ON CONFLICT (message_id) DO UPDATE
    SET routing_key = EXCLUDED.routing_key,
        payload = EXCLUDED.payload,
        state = 'pending',
    topology_error = NULL,
    published_at = NULL;
  `);
}

function applyConsumerTransaction(payload: string): void {
  queryPostgres(`
    BEGIN;
    WITH received AS (
      INSERT INTO foundation_conformance.messaging_inbox (message_id, payload)
      VALUES ('${messageId}', '${payload.replaceAll("'", "''")}'::jsonb)
      ON CONFLICT (message_id) DO NOTHING
      RETURNING message_id
    )
    INSERT INTO foundation_conformance.messaging_side_effect (message_id, effect_value)
    SELECT message_id, 'applied-once' FROM received;
    COMMIT;
  `);
}

function consumerState(): string {
  return queryPostgres(`
    SELECT
      (SELECT count(*) FROM foundation_conformance.messaging_inbox WHERE message_id = '${messageId}')
      || ':' ||
      (SELECT count(*) FROM foundation_conformance.messaging_side_effect WHERE message_id = '${messageId}');
  `);
}

messagingIntegration('RabbitMQ durable messaging conformance', () => {
  it('publishes a committed outbox item after broker restart and commits inbox side effects before ack', async () => {
    let connection: amqp.ChannelModel | undefined;
    let channel: ConfirmChannel | undefined;
    let consumerTag: string | undefined;
    let testQueueDeclared = false;
    let rabbitmqNeedsRestart = false;
    let deliveryAttempts = 0;
    let ackCount = 0;
    let consumerFailure: unknown;

    try {
      await waitForPostgres();
      await waitForRabbitMQ();
      createTestTables();
      commitOutboxItem();
      commitOutboxItem(
        unroutableMessageId,
        unroutableRoutingKey,
        messageEnvelope(unroutableMessageId)
      );

      const rabbitmqBinding = runCompose('port', 'rabbitmq', '5672');
      const rabbitmqHostPort = rabbitmqBinding.split(':').at(-1);
      if (!rabbitmqHostPort) {
        throw new Error(
          `Could not determine RabbitMQ's published host port from "${rabbitmqBinding}".`
        );
      }

      const rabbitmqEndpoint = `amqp://127.0.0.1:${rabbitmqHostPort}`;
      rabbitmqNeedsRestart = true;
      runCompose('stop', 'rabbitmq');
      await expect(connectToRabbitMQ(rabbitmqEndpoint)).rejects.toThrow();
      expect(
        queryPostgres(
          `SELECT state FROM foundation_conformance.messaging_outbox WHERE message_id = '${messageId}'`
        )
      ).toBe('pending');
      runCompose('start', 'rabbitmq');
      await waitForRabbitMQ();
      rabbitmqNeedsRestart = false;

      runCompose('restart', 'rabbitmq');
      await waitForRabbitMQ();

      expect(
        queryPostgres(
          `SELECT state FROM foundation_conformance.messaging_outbox WHERE message_id = '${messageId}'`
        )
      ).toBe('pending');
      const outboxItem = readOutboxItem();
      expect(outboxItem.payload.messageId).toBe(messageId);
      const unroutableItem = readOutboxItem(unroutableMessageId);
      expect(unroutableItem.payload.messageId).toBe(unroutableMessageId);

      connection = await connectToRabbitMQ();
      channel = await connection.createConfirmChannel();
      await declareDurableTestRoute(channel);
      testQueueDeclared = true;

      expect(
        await publishConfirmed(
          channel,
          JSON.stringify(outboxItem.payload),
          outboxItem.routingKey,
          messageId
        )
      ).toBe(true);
      queryPostgres(`
          UPDATE foundation_conformance.messaging_outbox
          SET state = 'published', published_at = now()
          WHERE message_id = '${messageId}' AND state = 'pending';
        `);
      expect(
        queryPostgres(
          `SELECT state FROM foundation_conformance.messaging_outbox WHERE message_id = '${messageId}'`
        )
      ).toBe('published');
      expect(
        await publishConfirmed(
          channel,
          JSON.stringify(unroutableItem.payload),
          unroutableItem.routingKey,
          unroutableMessageId
        )
      ).toBe(false);
      queryPostgres(`
        UPDATE foundation_conformance.messaging_outbox
        SET state = 'parked',
            topology_error = 'No durable queue is bound for the route.'
        WHERE message_id = '${unroutableMessageId}' AND state = 'pending';
      `);
      expect(
        queryPostgres(
          `SELECT state || ':' || (topology_error IS NOT NULL)::text FROM foundation_conformance.messaging_outbox WHERE message_id = '${unroutableMessageId}'`
        )
      ).toBe('parked:true');
      expect((await channel.checkQueue(queue)).messageCount).toBe(1);

      await channel.close();
      channel = undefined;
      await connection.close();
      connection = undefined;

      runCompose('restart', 'rabbitmq');
      await waitForRabbitMQ();

      connection = await connectToRabbitMQ();
      channel = await connection.createConfirmChannel();
      await declareDurableTestRoute(channel);
      await channel.prefetch(1);

      const firstAck = new Promise<void>((resolve, reject) => {
        void channel
          ?.consume(
            queue,
            (message) => {
              if (!message) {
                return;
              }

              void (async () => {
                try {
                  deliveryAttempts += 1;
                  expect(message.properties.messageId).toBe(messageId);
                  expect(message.fields.routingKey).toBe(routingKey);
                  const receivedPayload = message.content.toString('utf8');
                  expect(JSON.parse(receivedPayload).messageId).toBe(messageId);
                  applyConsumerTransaction(receivedPayload);
                  expect(consumerState()).toBe('1:1');
                  if (deliveryAttempts === 1) {
                    channel?.nack(message, false, true);
                    return;
                  }
                  channel?.ack(message);
                  ackCount += 1;
                  resolve();
                } catch (error) {
                  consumerFailure = error;
                  channel?.nack(message, false, false);
                  reject(error);
                }
              })();
            },
            { noAck: false }
          )
          .then((reply) => {
            consumerTag = reply.consumerTag;
          })
          .catch(reject);
      });

      await Promise.race([
        firstAck,
        delay(15_000).then(() => {
          throw consumerFailure ?? new Error('The durable outbox message was not delivered.');
        }),
      ]);
      expect(ackCount).toBe(1);
      expect(deliveryAttempts).toBe(2);
      expect(consumerState()).toBe('1:1');

      const secondAck = new Promise<void>((resolve, reject) => {
        const poll = async (): Promise<void> => {
          const deadline = Date.now() + 15_000;
          while (ackCount < 2 && !consumerFailure && Date.now() < deadline) {
            await delay(50);
          }

          if (consumerFailure) {
            reject(consumerFailure);
          } else if (ackCount === 2) {
            resolve();
          } else {
            reject(new Error('The duplicate message ID was not delivered.'));
          }
        };

        void poll();
      });

      const publisher = await connection.createConfirmChannel();
      expect(
        await publishConfirmed(
          publisher,
          JSON.stringify(outboxItem.payload),
          outboxItem.routingKey,
          messageId
        )
      ).toBe(true);
      await publisher.close();
      await secondAck;

      expect(ackCount).toBe(2);
      expect(deliveryAttempts).toBe(3);
      expect(consumerState()).toBe('1:1');
      expect(
        queryPostgres(
          `SELECT count(*) FROM foundation_conformance.messaging_side_effect WHERE message_id = '${messageId}'`
        )
      ).toBe('1');
    } finally {
      if (rabbitmqNeedsRestart) {
        runCompose('start', 'rabbitmq');
        await waitForRabbitMQ();
      }
      if (consumerTag && channel) {
        await channel.cancel(consumerTag).catch(() => undefined);
      }
      await channel?.close().catch(() => undefined);
      await connection?.close().catch(() => undefined);
      if (testQueueDeclared) {
        try {
          const cleanupConnection = await connectToRabbitMQ();
          const cleanupChannel = await cleanupConnection.createChannel();
          await cleanupChannel.deleteQueue(queue);
          await cleanupChannel.close();
          await cleanupConnection.close();
        } catch {
          // Preserve the original test failure if RabbitMQ stopped during cleanup.
        }
      }
      try {
        queryPostgres(`
            DELETE FROM foundation_conformance.messaging_side_effect WHERE message_id = '${messageId}';
            DELETE FROM foundation_conformance.messaging_inbox WHERE message_id = '${messageId}';
            DELETE FROM foundation_conformance.messaging_outbox WHERE message_id = '${messageId}';
            DELETE FROM foundation_conformance.messaging_outbox WHERE message_id = '${unroutableMessageId}';
          `);
      } catch {
        // Preserve the original test failure if PostgreSQL stopped during cleanup.
      }
    }
  }, 180_000);
});
