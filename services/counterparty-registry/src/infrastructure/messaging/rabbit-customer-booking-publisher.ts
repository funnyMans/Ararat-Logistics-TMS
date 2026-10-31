import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import type { DurableCustomerMessagePublisher } from '../../application/ports/counterparty-registry-repository';

export class RabbitCustomerBookingPublisher implements DurableCustomerMessagePublisher {
  constructor(
    private readonly channel: ConfirmChannel,
    private readonly exchange: string
  ) {}

  async publish(routingKey: string, messageId: string, payload: unknown): Promise<void> {
    let returnedRoutingKey: string | undefined;
    const onReturn = (message: ConsumeMessage) => {
      if (message.properties.messageId === messageId) {
        returnedRoutingKey = message.fields.routingKey;
      }
    };
    this.channel.on('return', onReturn);

    try {
      const messageType =
        typeof payload === 'object' &&
        payload !== null &&
        'messageType' in payload &&
        typeof payload.messageType === 'string'
          ? payload.messageType
          : undefined;
      this.channel.publish(this.exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
        contentType: 'application/json',
        deliveryMode: 2,
        mandatory: true,
        messageId,
        timestamp: Date.now(),
        ...(messageType === undefined ? {} : { type: messageType }),
      });
      await this.channel.waitForConfirms();
      if (returnedRoutingKey !== undefined) {
        throw new Error(`RabbitMQ has no route for "${returnedRoutingKey}".`);
      }
    } finally {
      this.channel.off('return', onReturn);
    }
  }
}
