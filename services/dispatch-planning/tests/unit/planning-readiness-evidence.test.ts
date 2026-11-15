import { describe, expect, it } from 'vitest';
import {
  evaluatePlanningReadinessEvidence,
  planningReadinessEvidenceSchema,
} from '../../src/domain/planning-readiness-evidence';
import { syntheticPlanningReadinessEvidence } from '../fixtures/synthetic-planning-readiness-evidence';

describe('Dispatch Planning readiness evidence', () => {
  it('does not accept complete-looking synthetic evidence for operational planning', () => {
    const evaluation = evaluatePlanningReadinessEvidence(syntheticPlanningReadinessEvidence);

    expect(evaluation.outcome).toBe('BLOCKED');
    expect(evaluation.blockers).toContain('Route validation uses synthetic evidence.');
    expect(evaluation.blockers).toContain('Service-time calibration uses synthetic evidence.');
    expect(evaluation.blockers).toContain('Fleet Readiness catalogue uses synthetic evidence.');
    expect(evaluation.blockers).toContain('Dispatch acceptance uses synthetic evidence.');
  });

  it('fails closed when replay evidence reports hard-gate violations or double commitments', () => {
    const evaluation = evaluatePlanningReadinessEvidence({
      ...syntheticPlanningReadinessEvidence,
      dispatchAcceptance: {
        ...syntheticPlanningReadinessEvidence.dispatchAcceptance,
        hardGateViolations: 1,
        doubleCommitments: 1,
      },
    });

    expect(evaluation.outcome).toBe('BLOCKED');
    expect(evaluation.blockers).toContain('Historical replay contains hard-gate violations.');
    expect(evaluation.blockers).toContain('Historical replay contains double commitments.');
  });

  it('rejects unknown evidence fields instead of silently stripping them', () => {
    const result = planningReadinessEvidenceSchema.safeParse({
      ...syntheticPlanningReadinessEvidence,
      routeValidation: {
        ...syntheticPlanningReadinessEvidence.routeValidation,
        assumedSafe: true,
      },
    });

    expect(result.success).toBe(false);
  });
});
