import { connect } from 'amqplib';
import {
  CAPACITY_COMMAND_EXCHANGE,
  CAPACITY_COMMAND_QUEUE,
  CAPACITY_COMMAND_ROUTING_KEYS,
  CAPACITY_OUTCOME_EXCHANGE,
  CAPACITY_OUTCOME_QUEUE,
  CAPACITY_OUTCOME_ROUTING_KEYS,
  CAPACITY_RABBITMQ_VHOST,
} from './infrastructure/messaging/capacity-topology';

interface TopologyConfig {
  adminAmqpUrl: string;
  managementApiUrl: string;
  adminUser: string;
  adminPassword: string;
  applicationUser: string;
  applicationPassword: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function readConfig(): TopologyConfig {
  const applicationPassword = required('CAPACITY_RABBITMQ_APP_PASSWORD');
  if (applicationPassword.length < 24) {
    throw new RangeError('CAPACITY_RABBITMQ_APP_PASSWORD must be at least 24 characters.');
  }
  return {
    adminAmqpUrl: required('CAPACITY_RABBITMQ_ADMIN_AMQP_URL'),
    managementApiUrl: required('CAPACITY_RABBITMQ_MANAGEMENT_API_URL').replace(/\/+$/, ''),
    adminUser: required('CAPACITY_RABBITMQ_ADMIN_USER'),
    adminPassword: required('CAPACITY_RABBITMQ_ADMIN_PASSWORD'),
    applicationUser: required('CAPACITY_RABBITMQ_APP_USER'),
    applicationPassword,
  };
}

async function putManagementResource(
  config: TopologyConfig,
  path: string,
  body: Record<string, unknown>
): Promise<void> {
  const response = await fetch(`${config.managementApiUrl}${path}`, {
    method: 'PUT',
    headers: {
      authorization: `Basic ${Buffer.from(`${config.adminUser}:${config.adminPassword}`).toString('base64')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `RabbitMQ topology provisioning failed for ${path} (${response.status}): ${details}`
    );
  }
}

async function provision(config: TopologyConfig): Promise<void> {
  const encodedVhost = encodeURIComponent(CAPACITY_RABBITMQ_VHOST);
  const encodedApplicationUser = encodeURIComponent(config.applicationUser);
  await putManagementResource(config, `/vhosts/${encodedVhost}`, {});
  await putManagementResource(config, `/users/${encodedApplicationUser}`, {
    password: config.applicationPassword,
    tags: '',
  });
  await putManagementResource(config, `/permissions/${encodedVhost}/${encodedApplicationUser}`, {
    configure: '',
    write: `^${CAPACITY_OUTCOME_EXCHANGE.replaceAll('.', '\\.')}$`,
    read: `^${CAPACITY_COMMAND_QUEUE.replaceAll('.', '\\.')}$`,
  });

  const adminUrl = new URL(config.adminAmqpUrl);
  adminUrl.pathname = `/${CAPACITY_RABBITMQ_VHOST}`;
  const connection = await connect(adminUrl.toString());
  try {
    const channel = await connection.createChannel();
    try {
      await channel.assertExchange(CAPACITY_COMMAND_EXCHANGE, 'topic', { durable: true });
      await channel.assertExchange(CAPACITY_OUTCOME_EXCHANGE, 'topic', { durable: true });
      await channel.assertQueue(CAPACITY_COMMAND_QUEUE, { durable: true });
      await channel.assertQueue(CAPACITY_OUTCOME_QUEUE, { durable: true });
      for (const routingKey of CAPACITY_COMMAND_ROUTING_KEYS) {
        await channel.bindQueue(CAPACITY_COMMAND_QUEUE, CAPACITY_COMMAND_EXCHANGE, routingKey);
      }
      for (const routingKey of CAPACITY_OUTCOME_ROUTING_KEYS) {
        await channel.bindQueue(CAPACITY_OUTCOME_QUEUE, CAPACITY_OUTCOME_EXCHANGE, routingKey);
      }
    } finally {
      await channel.close();
    }
  } finally {
    await connection.close();
  }
}

void Promise.resolve()
  .then(() => provision(readConfig()))
  .then(
    () => console.info('Capacity Commitment RabbitMQ topology and application ACLs are current.'),
    (error: unknown) => {
      console.error('Capacity Commitment RabbitMQ topology provisioning failed.', error);
      process.exitCode = 1;
    }
  );
