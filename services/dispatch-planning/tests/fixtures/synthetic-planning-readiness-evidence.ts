import type { PlanningReadinessEvidence } from '../../src/domain/planning-readiness-evidence';

const syntheticApproval = {
  approvedBy: 'synthetic-fixture-only',
  reference: 'fixture:synthetic-owner-approval',
};

export const syntheticPlanningReadinessEvidence: PlanningReadinessEvidence = {
  routeValidation: {
    status: 'ACCEPTED',
    evidenceMode: 'SYNTHETIC',
    provider: 'TRIMBLE_MAPS_PC_MILER',
    representativeLaneCount: 1,
    actualOutcomeCount: 1,
    requestResponseProvenanceComplete: true,
    ownerApproval: syntheticApproval,
  },
  serviceTimeCalibration: {
    status: 'ACCEPTED',
    evidenceMode: 'SYNTHETIC',
    completedTripCount: 1,
    stopCategories: ['synthetic-stop-category'],
    assumptionsVersion: 'synthetic-v1',
    ownerApproval: syntheticApproval,
  },
  fleetReadinessCatalogue: {
    status: 'ACCEPTED',
    evidenceMode: 'SYNTHETIC',
    catalogueComplete: true,
    facts: [
      {
        factKey: 'synthetic-fact',
        sourceReference: 'fixture:source',
        verifierRole: 'synthetic-reviewer',
        evidenceReference: 'fixture:evidence',
        validityRule: 'synthetic-only',
        revisionRule: 'synthetic-only',
        consumingGate: 'synthetic-only',
      },
    ],
    ownerApproval: syntheticApproval,
  },
  dispatchAcceptance: {
    status: 'ACCEPTED',
    evidenceMode: 'SYNTHETIC',
    historicalReplayCount: 1,
    hardGateViolations: 0,
    doubleCommitments: 0,
    deterministicMatchingVerified: true,
    nominalScenarioPassed: true,
    failureScenarioPassed: true,
    recoveryScenarioPassed: true,
    ownerApproval: syntheticApproval,
  },
};
