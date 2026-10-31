import type { Channel, ConsumeMessage } from 'amqplib';
import type { AnswerCustomerBookingFactSnapshot } from '../../application/commands/answer-customer-booking-fact-snapshot';
import { customerBookingSnapshotRequestSchema } from '../../interfaces/messaging/customer-booking-snapshot-request';

export type RegistrySnapshotConsumerErrorHandler = (
  error: unknown,
  messageId: string | undefined
) => void;

export type RegistrySnapshotQuarantineHandler = (messageId: string) => void;

export class CustomerBookingSnapshotConsumer {
  constructor(
    private readonly answerSnapshot: AnswerCustomerBookingFactSnapshot,
    private readonly onError: RegistrySnapshotConsumerErrorHandler,
    private readonly onQuarantine: RegistrySnapshotQuarantineHandler
  ) {}

  async start(channel: Channel, queue: string): Promise<string> {
    if (!queue.trim()) {
      throw new TypeError('A deployment-provisioned Customer snapshot queue is required.');
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
    const messageId = message.properties.messageId;
    let payload: unknown;
    try {
      payload = JSON.parse(message.content.toString('utf8'));
    } catch (error) {
      this.onError(error, messageId);
      channel.nack(message, false, false);
      return;
    }
    const parsed = customerBookingSnapshotRequestSchema.safeParse(payload);
    if (!parsed.success) {
      this.onError(parsed.error, messageId);
      channel.nack(message, false, false);
      return;
    }

    try {
      const result = await this.answerSnapshot.execute(parsed.data);
      if (result === 'quarantined') {
        this.onQuarantine(parsed.data.messageId);
      }
      channel.ack(message);
    } catch (error) {
      this.onError(error, parsed.data.messageId);
      channel.nack(message, false, true);
    }
  }
}
