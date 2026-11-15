import type {
  CounterpartyRegistryRepository,
  CustomerBookingSnapshotRequest,
} from '../ports/counterparty-registry-repository';

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InvalidCustomerBookingSnapshotRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCustomerBookingSnapshotRequestError';
  }
}

function validateRequest(request: CustomerBookingSnapshotRequest): void {
  for (const [field, value] of [
    ['messageId', request.messageId],
    ['correlationId', request.correlationId],
    ['customerId', request.payload.customerId],
  ] as const) {
    if (!UUID_V7_PATTERN.test(value)) {
      throw new InvalidCustomerBookingSnapshotRequestError(`${field} must be a UUIDv7.`);
    }
  }
  if (
    !Number.isSafeInteger(request.payload.minimumRegistrySequence) ||
    request.payload.minimumRegistrySequence < 0 ||
    !Number.isSafeInteger(request.payload.lastAppliedOwnerRevision) ||
    request.payload.lastAppliedOwnerRevision < 0
  ) {
    throw new InvalidCustomerBookingSnapshotRequestError(
      'Snapshot sequence and revision values must be non-negative safe integers.'
    );
  }
  if (
    request.payload.observedOwnerRevision !== undefined &&
    (!Number.isSafeInteger(request.payload.observedOwnerRevision) ||
      request.payload.observedOwnerRevision < 1)
  ) {
    throw new InvalidCustomerBookingSnapshotRequestError(
      'observedOwnerRevision must be a positive safe integer.'
    );
  }
  if (
    request.messageType !== 'counterparty.customer.booking-fact.snapshot.get' ||
    request.sourceService !== 'load' ||
    request.targetService !== 'counterparty-registry' ||
    request.schemaVersion !== '1.0.0'
  ) {
    throw new InvalidCustomerBookingSnapshotRequestError(
      'The snapshot request does not match the Customer booking-fact contract.'
    );
  }
}

export class AnswerCustomerBookingFactSnapshot {
  constructor(private readonly repository: CounterpartyRegistryRepository) {}

  async execute(request: CustomerBookingSnapshotRequest) {
    validateRequest(request);
    return this.repository.answerCustomerBookingFactSnapshot(request);
  }
}
