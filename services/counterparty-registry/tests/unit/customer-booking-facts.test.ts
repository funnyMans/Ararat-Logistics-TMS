import { describe, expect, it, vi } from 'vitest';
import {
  AnswerCustomerBookingFactSnapshot,
  InvalidCustomerBookingSnapshotRequestError,
} from '../../src/application/commands/answer-customer-booking-fact-snapshot';
import {
  InvalidCustomerBookingFactCommandError,
  RecordCustomerBookingFact,
} from '../../src/application/commands/record-customer-booking-fact';
import type { CounterpartyRegistryRepository } from '../../src/application/ports/counterparty-registry-repository';

const customerId = '018f47a2-7b3c-7abc-8def-123456789abc';
const counterpartyId = '018f47a2-7b3c-7abc-8def-123456789abd';
const principalId = '018f47a2-7b3c-7abc-8def-123456789abe';
const messageId = '018f47a2-7b3c-7abc-8def-123456789abf';

function createRepository(): CounterpartyRegistryRepository {
  return {
    recordCustomerBookingFact: vi.fn(async () => null),
    answerCustomerBookingFactSnapshot: vi.fn(async () => 'queued'),
    enqueueCompletenessWatermarkIfDue: vi.fn(async () => false),
    publishNextOutboxMessage: vi.fn(async () => false),
  };
}

describe('Counterparty Registry Customer booking facts', () => {
  it('trims owner-provided legal name and reason before recording', async () => {
    const repository = createRepository();
    const command = new RecordCustomerBookingFact(repository);

    await command.execute({
      customerId,
      counterpartyId,
      status: 'ACTIVE',
      legalName: '  Example Customer LLC  ',
      actorPrincipalId: principalId,
      reason: '  verified onboarding  ',
    });

    expect(repository.recordCustomerBookingFact).toHaveBeenCalledWith({
      customerId,
      counterpartyId,
      status: 'ACTIVE',
      legalName: 'Example Customer LLC',
      actorPrincipalId: principalId,
      reason: 'verified onboarding',
    });
  });

  it('rejects invalid Registry identifiers and empty owner values before persistence', async () => {
    const repository = createRepository();
    const command = new RecordCustomerBookingFact(repository);
    const baseCommand = {
      customerId,
      counterpartyId,
      status: 'ACTIVE' as const,
      legalName: 'Example Customer LLC',
      actorPrincipalId: principalId,
      reason: 'verified onboarding',
    };

    await expect(
      command.execute({ ...baseCommand, customerId: 'not-a-uuid' })
    ).rejects.toBeInstanceOf(InvalidCustomerBookingFactCommandError);
    await expect(command.execute({ ...baseCommand, legalName: '  ' })).rejects.toBeInstanceOf(
      InvalidCustomerBookingFactCommandError
    );
    expect(repository.recordCustomerBookingFact).not.toHaveBeenCalled();
  });

  it('validates and delegates snapshot requests to the Registry owner repository', async () => {
    const repository = createRepository();
    const command = new AnswerCustomerBookingFactSnapshot(repository);
    const request = {
      messageId,
      messageType: 'counterparty.customer.booking-fact.snapshot.get' as const,
      schemaVersion: '1.0.0' as const,
      sourceService: 'load' as const,
      targetService: 'counterparty-registry' as const,
      issuedAt: '2026-01-01T00:00:00.000Z',
      correlationId: messageId,
      payload: {
        customerId,
        lastAppliedOwnerRevision: 2,
        minimumRegistrySequence: 6,
        observedOwnerRevision: 3,
        reason: 'REVISION_GAP' as const,
      },
    };

    await expect(command.execute(request)).resolves.toBe('queued');
    expect(repository.answerCustomerBookingFactSnapshot).toHaveBeenCalledWith(request);

    await expect(
      command.execute({
        ...request,
        payload: { ...request.payload, minimumRegistrySequence: -1 },
      })
    ).rejects.toBeInstanceOf(InvalidCustomerBookingSnapshotRequestError);
  });
});
