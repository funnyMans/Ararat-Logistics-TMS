import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import type { CustomerBookingSnapshotPublisher } from '../persistence/postgres-customer-booking-projection-repository';

export class RabbitCustomerBookingPublisher implements CustomerBookingSnapshotPublisher {
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
      this.channel.publish(this.exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
        contentType: 'application/json',
        deliveryMode: 2,
        mandatory: true,
        messageId,
        timestamp: Date.now(),
        type: 'counterparty.customer.booking-fact.snapshot.get',
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
