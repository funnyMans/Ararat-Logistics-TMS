import { isCustomerBookingStatus } from '../../domain/customer-booking/customer-booking-fact';
import type {
  CounterpartyRegistryRepository,
  RecordCustomerBookingFactCommand,
} from '../ports/counterparty-registry-repository';

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InvalidCustomerBookingFactCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCustomerBookingFactCommandError';
  }
}

function validateCommand(command: RecordCustomerBookingFactCommand): void {
  for (const [field, value] of [
    ['customerId', command.customerId],
    ['counterpartyId', command.counterpartyId],
    ['actorPrincipalId', command.actorPrincipalId],
  ] as const) {
    if (!UUID_V7_PATTERN.test(value)) {
      throw new InvalidCustomerBookingFactCommandError(`${field} must be a UUIDv7.`);
    }
  }
  if (command.correlationId !== undefined && !UUID_V7_PATTERN.test(command.correlationId)) {
    throw new InvalidCustomerBookingFactCommandError('correlationId must be a UUIDv7.');
  }
  if (!command.legalName.trim()) {
    throw new InvalidCustomerBookingFactCommandError('legalName must not be empty.');
  }
  if (!command.reason.trim()) {
    throw new InvalidCustomerBookingFactCommandError('reason must not be empty.');
  }
  if (!isCustomerBookingStatus(command.status)) {
    throw new InvalidCustomerBookingFactCommandError('status is not a supported Customer status.');
  }
}

export class RecordCustomerBookingFact {
  constructor(private readonly repository: CounterpartyRegistryRepository) {}

  async execute(command: RecordCustomerBookingFactCommand) {
    validateCommand(command);
    return this.repository.recordCustomerBookingFact({
      ...command,
      legalName: command.legalName.trim(),
      reason: command.reason.trim(),
    });
  }
}
