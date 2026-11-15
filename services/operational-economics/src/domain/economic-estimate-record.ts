import { z } from 'zod';

const revisionSchema = z.string().trim().min(1).max(128);
const snapshotSchema = z.record(z.string(), z.unknown());

const loadScopeSchema = z
  .object({
    type: z.literal('load'),
    loadId: z.uuid(),
    loadRevision: revisionSchema,
  })
  .strict();

const candidateScopeSchema = z
  .object({
    type: z.literal('candidate'),
    loadId: z.uuid(),
    loadRevision: revisionSchema,
    trioId: z.uuid(),
    trioRevision: revisionSchema,
  })
  .strict();

const provenanceEntrySchema = z
  .object({
    source: z.string().trim().min(1).max(100),
    reference: z.string().trim().min(1).max(500),
    revision: revisionSchema,
    observedAt: z.iso.datetime(),
  })
  .strict();

export const economicEstimateRecordInputSchema = z
  .object({
    contractVersion: z.literal('1.0.0'),
    estimateId: z.uuid(),
    scope: z.discriminatedUnion('type', [loadScopeSchema, candidateScopeSchema]),
    modelVersion: z.string().trim().min(1).max(100),
    inputSchemaVersion: z.string().trim().min(1).max(100),
    resultSchemaVersion: z.string().trim().min(1).max(100),
    inputs: snapshotSchema,
    result: snapshotSchema,
    provenance: z.array(provenanceEntrySchema).max(100),
    generatedAt: z.iso.datetime(),
  })
  .strict();

export const economicEstimateRecordSchema = economicEstimateRecordInputSchema
  .extend({
    recordedAt: z.iso.datetime(),
  })
  .strict();

export type EconomicEstimateRecordInput = z.infer<typeof economicEstimateRecordInputSchema>;
export type EconomicEstimateRecord = z.infer<typeof economicEstimateRecordSchema>;
export type EconomicEstimateScope = EconomicEstimateRecordInput['scope'];
