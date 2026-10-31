import { z } from 'zod';

const uuidV7 = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const status = z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED']);
const baseEnvelope = {
  messageId: uuidV7,
  schemaVersion: z.literal('1.0.0'),
  sourceService: z.literal('counterparty-registry'),
  targetService: z.literal('load'),
  correlationId: uuidV7,
};

export const customerBookingFactChangedSchema = z
  .object({
    ...baseEnvelope,
    messageType: z.literal('counterparty.customer.booking-fact.changed'),
    occurredAt: z.string().datetime({ offset: true }),
    causationId: uuidV7.optional(),
    ownerRevision: z.number().int().positive().safe(),
    registrySequence: z.number().int().positive().safe(),
    payload: z
      .object({
        customerId: uuidV7,
        status,
        legalName: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();

export const customerBookingFactWatermarkSchema = z
  .object({
    ...baseEnvelope,
    messageType: z.literal('counterparty.customer.booking-fact.watermark'),
    occurredAt: z.string().datetime({ offset: true }),
    payload: z
      .object({
        highWatermarkSequence: z.number().int().nonnegative().safe(),
      })
      .strict(),
  })
  .strict();

export const customerBookingFactSnapshotResultSchema = z
  .object({
    ...baseEnvelope,
    messageType: z.literal('counterparty.customer.booking-fact.snapshot.result'),
    occurredAt: z.string().datetime({ offset: true }),
    causationId: uuidV7,
    ownerRevision: z.number().int().positive().safe().optional(),
    payload: z.discriminatedUnion('result', [
      z
        .object({
          customerId: uuidV7,
          result: z.literal('FOUND'),
          status,
          legalName: z.string().trim().min(1),
          ownerRevision: z.number().int().positive().safe(),
          registrySequence: z.number().int().nonnegative().safe(),
        })
        .strict(),
      z
        .object({
          customerId: uuidV7,
          result: z.literal('NOT_FOUND'),
          registrySequence: z.number().int().nonnegative().safe(),
        })
        .strict(),
    ]),
  })
  .strict();

export const customerBookingIncomingMessageSchema = z.discriminatedUnion('messageType', [
  customerBookingFactChangedSchema,
  customerBookingFactWatermarkSchema,
  customerBookingFactSnapshotResultSchema,
]);

export type CustomerBookingIncomingMessage = z.infer<typeof customerBookingIncomingMessageSchema>;
