import { describe, expect, it } from 'vitest';
import {
  economicEstimateRecordInputSchema,
  type EconomicEstimateRecordInput,
} from '../../src/domain/economic-estimate-record';

const validLoadEstimate: EconomicEstimateRecordInput = {
  contractVersion: '1.0.0',
  estimateId: '0197e9e9-2dc0-7000-8000-000000000001',
  scope: {
    type: 'load',
    loadId: '0197e9e9-2dc0-7000-8000-000000000002',
    loadRevision: '17',
  },
  modelVersion: 'model-pending',
  inputSchemaVersion: 'inputs-pending',
  resultSchemaVersion: 'result-pending',
  inputs: { source: 'not-yet-defined' },
  result: { status: 'not-yet-defined' },
  provenance: [],
  generatedAt: '2026-01-15T12:00:00.000Z',
};

describe('economic estimate record contract', () => {
  it('accepts immutable load-level and candidate-level scopes', () => {
    expect(economicEstimateRecordInputSchema.safeParse(validLoadEstimate).success).toBe(true);

    const candidateEstimate = {
      ...validLoadEstimate,
      estimateId: '0197e9e9-2dc0-7000-8000-000000000003',
      scope: {
        type: 'candidate' as const,
        loadId: validLoadEstimate.scope.loadId,
        loadRevision: '17',
        trioId: '0197e9e9-2dc0-7000-8000-000000000004',
        trioRevision: '6',
      },
    };
    expect(economicEstimateRecordInputSchema.safeParse(candidateEstimate).success).toBe(true);
  });

  it('rejects candidate estimates without the Trio source revision', () => {
    const invalidCandidate = {
      ...validLoadEstimate,
      scope: {
        type: 'candidate',
        loadId: validLoadEstimate.scope.loadId,
        loadRevision: '17',
        trioId: '0197e9e9-2dc0-7000-8000-000000000004',
      },
    };
    expect(economicEstimateRecordInputSchema.safeParse(invalidCandidate).success).toBe(false);
  });

  it('rejects planning-cycle and matrix fields outside the estimate contract', () => {
    expect(
      economicEstimateRecordInputSchema.safeParse({
        ...validLoadEstimate,
        planningAttemptId: '0197e9e9-2dc0-7000-8000-000000000005',
        matrix: [],
      }).success
    ).toBe(false);
  });
});
