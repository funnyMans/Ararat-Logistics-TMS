import type { Channel, ConsumeMessage } from 'amqplib';
import type { CapacityCommitmentRepository } from '../../application/ports/capacity-commitment-ports';
import { capacityCommitmentCommandSchema } from '../../interfaces/messaging/capacity-commitment-messages';
import { CapacityIdempotencyConflictError } from '../persistence/postgres-capacity-commitment-repository';
import { CAPACITY_COMMAND_ROUTING_KEYS } from './capacity-topology';

export type CapacityConsumerErrorHandler = (error: unknown, messageId: string | undefined) => void;

const commandRoutingKeys = {
  'capacity.reservation.reserve': CAPACITY_COMMAND_ROUTING_KEYS[0],
  'capacity.reservation.confirm': CAPACITY_COMMAND_ROUTING_KEYS[1],
  'capacity.reservation.release': CAPACITY_COMMAND_ROUTING_KEYS[2],
  'capacity.reservation.replace': CAPACITY_COMMAND_ROUTING_KEYS[3],
} as const;

export class CapacityCommandConsumer {
  constructor(
    private readonly repository: CapacityCommitmentRepository,
    private readonly onError: CapacityConsumerErrorHandler
  ) {}

  async start(channel: Channel, queue: string): Promise<string> {
    if (!queue.trim()) {
      throw new TypeError(
        'A deployment-provisioned Capacity Commitment command queue is required.'
      );
    }
    await channel.prefetch(1);
    const consumer = await channel.consume(
      queue,
      (message) => {
        if (message) {
          void this.handleDelivery(channel, message).catch((error: unknown) => {
            this.onError(error, message.properties.messageId);
          });
        }
      },
      { noAck: false }
    );
    return consumer.consumerTag;
  }

  private async handleDelivery(channel: Channel, message: ConsumeMessage): Promise<void> {
    let value: unknown;
    try {
      value = JSON.parse(message.content.toString('utf8'));
    } catch (error) {
      this.onError(error, message.properties.messageId);
      channel.nack(message, false, false);
      return;
    }

    const parsed = capacityCommitmentCommandSchema.safeParse(value);
    if (!parsed.success) {
      this.onError(parsed.error, message.properties.messageId);
      channel.nack(message, false, false);
      return;
    }
    if (
      message.properties.messageId !== undefined &&
      message.properties.messageId !== parsed.data.messageId
    ) {
      this.onError(
        new Error('AMQP messageId does not match the Capacity Commitment envelope messageId.'),
        parsed.data.messageId
      );
      channel.nack(message, false, false);
      return;
    }
    if (message.fields.routingKey !== commandRoutingKeys[parsed.data.messageType]) {
      this.onError(
        new Error('AMQP routing key does not match the Capacity Commitment command messageType.'),
        parsed.data.messageId
      );
      channel.nack(message, false, false);
      return;
    }

    try {
      await this.repository.execute(parsed.data);
      channel.ack(message);
    } catch (error) {
      this.onError(error, parsed.data.messageId);
      channel.nack(message, false, !(error instanceof CapacityIdempotencyConflictError));
    }
  }
}
