import type { Channel, ConsumeMessage } from 'amqplib';
import type { PostgresCustomerBookingProjectionRepository } from '../persistence/postgres-customer-booking-projection-repository';
import { customerBookingIncomingMessageSchema } from '../../interfaces/messaging/customer-booking-messages';

export type CustomerBookingConsumerErrorHandler = (
  error: unknown,
  messageId: string | undefined
) => void;

export type CustomerBookingQuarantineHandler = (messageId: string) => void;

export class CustomerBookingFactConsumer {
  constructor(
    private readonly repository: PostgresCustomerBookingProjectionRepository,
    private readonly onError: CustomerBookingConsumerErrorHandler,
    private readonly onQuarantine: CustomerBookingQuarantineHandler
  ) {}

  async start(channel: Channel, queue: string): Promise<string> {
    if (!queue.trim()) {
      throw new TypeError('A deployment-provisioned Customer booking fact queue is required.');
    }
    await channel.prefetch(1);
    const consumer = await channel.consume(
      queue,
      (message) => {
        if (message) {
          void this.handleDelivery(channel, message);
        }
      },
      { noAck: false }
    );
    return consumer.consumerTag;
  }

  private async handleDelivery(channel: Channel, message: ConsumeMessage): Promise<void> {
    const raw = message.content.toString('utf8');
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch (error) {
      this.onError(error, message.properties.messageId);
      channel.nack(message, false, false);
      return;
    }

    const parsedMessage = customerBookingIncomingMessageSchema.safeParse(parsedJson);
    if (!parsedMessage.success) {
      this.onError(parsedMessage.error, message.properties.messageId);
      channel.nack(message, false, false);
      return;
    }

    try {
      const result = await this.repository.receive(parsedMessage.data);
      if (result === 'quarantined') {
        this.onQuarantine(parsedMessage.data.messageId);
      }
      channel.ack(message);
    } catch (error) {
      this.onError(error, parsedMessage.data.messageId);
      channel.nack(message, false, true);
    }
  }
}
