import type {
  CounterpartyRegistryRepository,
  DurableCustomerMessagePublisher,
} from '../ports/counterparty-registry-repository';

export class PublishCustomerBookingFacts {
  constructor(
    private readonly repository: CounterpartyRegistryRepository,
    private readonly publisher: DurableCustomerMessagePublisher
  ) {}

  async publishNext() {
    return this.repository.publishNextOutboxMessage(this.publisher);
  }

  async enqueueCompletenessWatermarkIfDue(now?: Date) {
    return this.repository.enqueueCompletenessWatermarkIfDue(now);
  }
}
