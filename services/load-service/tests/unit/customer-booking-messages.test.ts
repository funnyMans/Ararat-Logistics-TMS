import { describe, expect, it } from 'vitest';
import { customerBookingIncomingMessageSchema } from '../../src/interfaces/messaging/customer-booking-messages';

const customerId = '018f47a2-7b3c-7abc-8def-123456789abc';
const messageId = '018f47a2-7b3c-7abc-8def-123456789abd';
const correlationId = '018f47a2-7b3c-7abc-8def-123456789abe';
const occurredAt = '2026-03-20T12:00:00.000Z';

describe('Customer booking fact messages', () => {
  it('accepts a versioned full Customer booking fact', () => {
    const result = customerBookingIncomingMessageSchema.safeParse({
      messageId,
      messageType: 'counterparty.customer.booking-fact.changed',
      schemaVersion: '1.0.0',
      sourceService: 'counterparty-registry',
      targetService: 'load',
      occurredAt,
      correlationId,
      ownerRevision: 1,
      registrySequence: 4,
      payload: {
        customerId,
        status: 'ACTIVE',
        legalName: 'Customer One LLC',
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects malformed identifiers and fields outside the published contract', () => {
    const malformedId = customerBookingIncomingMessageSchema.safeParse({
      messageId: '00000000-0000-4000-8000-000000000001',
      messageType: 'counterparty.customer.booking-fact.changed',
      schemaVersion: '1.0.0',
      sourceService: 'counterparty-registry',
      targetService: 'load',
      occurredAt,
      correlationId,
      ownerRevision: 1,
      registrySequence: 4,
      payload: { customerId, status: 'ACTIVE', legalName: 'Customer One LLC' },
    });
    const extraField = customerBookingIncomingMessageSchema.safeParse({
      messageId,
      messageType: 'counterparty.customer.booking-fact.changed',
      schemaVersion: '1.0.0',
      sourceService: 'counterparty-registry',
      targetService: 'load',
      occurredAt,
      correlationId,
      ownerRevision: 1,
      registrySequence: 4,
      payload: {
        customerId,
        status: 'ACTIVE',
        legalName: 'Customer One LLC',
        contactEmail: 'not-in-scope@example.test',
      },
    });

    expect(malformedId.success).toBe(false);
    expect(extraField.success).toBe(false);
  });
});
