import { z } from 'zod';

const uuidV7 = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

export const customerBookingSnapshotRequestSchema = z
  .object({
    messageId: uuidV7,
    messageType: z.literal('counterparty.customer.booking-fact.snapshot.get'),
    schemaVersion: z.literal('1.0.0'),
    sourceService: z.literal('load'),
    targetService: z.literal('counterparty-registry'),
    issuedAt: z.string().datetime({ offset: true }),
    correlationId: uuidV7,
    causationId: uuidV7.optional(),
    initiatingPrincipalId: uuidV7.optional(),
    payload: z
      .object({
        customerId: uuidV7,
        lastAppliedOwnerRevision: z.number().int().nonnegative().safe(),
        minimumRegistrySequence: z.number().int().nonnegative().safe(),
        observedOwnerRevision: z.number().int().positive().safe().optional(),
        reason: z.enum(['MISSING', 'REVISION_GAP', 'REGISTRY_SEQUENCE_GAP', 'STALE', 'STREAM_GAP']),
      })
      .strict(),
  })
  .strict();

export type ParsedCustomerBookingSnapshotRequest = z.infer<
  typeof customerBookingSnapshotRequestSchema
>;
