import { z } from 'zod';

const evidenceStatusSchema = z.enum(['PENDING', 'IN_REVIEW', 'ACCEPTED']);
const evidenceModeSchema = z.enum(['SYNTHETIC', 'OPERATIONAL']);

const ownerApprovalSchema = z.strictObject({
  approvedBy: z.string().trim().min(1).nullable(),
  reference: z.string().trim().min(1).nullable(),
});

const routeValidationSchema = z.strictObject({
  status: evidenceStatusSchema,
  evidenceMode: evidenceModeSchema,
  provider: z.literal('TRIMBLE_MAPS_PC_MILER'),
  representativeLaneCount: z.number().int().nonnegative(),
  actualOutcomeCount: z.number().int().nonnegative(),
  requestResponseProvenanceComplete: z.boolean(),
  ownerApproval: ownerApprovalSchema,
});

const serviceTimeCalibrationSchema = z.strictObject({
  status: evidenceStatusSchema,
  evidenceMode: evidenceModeSchema,
  completedTripCount: z.number().int().nonnegative(),
  stopCategories: z.array(z.string().trim().min(1)),
  assumptionsVersion: z.string().trim().min(1).nullable(),
  ownerApproval: ownerApprovalSchema,
});

const fleetReadinessFactSchema = z.strictObject({
  factKey: z.string().trim().min(1),
  sourceReference: z.string().trim().min(1),
  verifierRole: z.string().trim().min(1),
  evidenceReference: z.string().trim().min(1),
  validityRule: z.string().trim().min(1),
  revisionRule: z.string().trim().min(1),
  consumingGate: z.string().trim().min(1),
});

const fleetReadinessCatalogueSchema = z.strictObject({
  status: evidenceStatusSchema,
  evidenceMode: evidenceModeSchema,
  catalogueComplete: z.boolean(),
  facts: z.array(fleetReadinessFactSchema),
  ownerApproval: ownerApprovalSchema,
});

const dispatchAcceptanceSchema = z.strictObject({
  status: evidenceStatusSchema,
  evidenceMode: evidenceModeSchema,
  historicalReplayCount: z.number().int().nonnegative(),
  hardGateViolations: z.number().int().nonnegative(),
  doubleCommitments: z.number().int().nonnegative(),
  deterministicMatchingVerified: z.boolean(),
  nominalScenarioPassed: z.boolean(),
  failureScenarioPassed: z.boolean(),
  recoveryScenarioPassed: z.boolean(),
  ownerApproval: ownerApprovalSchema,
});

export const planningReadinessEvidenceSchema = z.strictObject({
  routeValidation: routeValidationSchema,
  serviceTimeCalibration: serviceTimeCalibrationSchema,
  fleetReadinessCatalogue: fleetReadinessCatalogueSchema,
  dispatchAcceptance: dispatchAcceptanceSchema,
});

export type PlanningReadinessEvidence = z.infer<typeof planningReadinessEvidenceSchema>;

export type PlanningReadinessEvidenceEvaluation =
  | { outcome: 'BLOCKED'; blockers: string[] }
  | { outcome: 'EVIDENCE_COMPLETE_REQUIRES_OWNER_ACCEPTANCE'; blockers: [] };

function requireAcceptedEvidence(
  name: string,
  section: {
    status: z.infer<typeof evidenceStatusSchema>;
    evidenceMode: z.infer<typeof evidenceModeSchema>;
    ownerApproval: z.infer<typeof ownerApprovalSchema>;
  },
  blockers: string[]
): void {
  if (section.status !== 'ACCEPTED') {
    blockers.push(`${name} evidence is not owner-accepted.`);
  }
  if (section.evidenceMode !== 'OPERATIONAL') {
    blockers.push(`${name} uses synthetic evidence.`);
  }
  if (!section.ownerApproval.approvedBy || !section.ownerApproval.reference) {
    blockers.push(`${name} is missing a verifiable owner approval reference.`);
  }
}

export function evaluatePlanningReadinessEvidence(
  input: unknown
): PlanningReadinessEvidenceEvaluation {
  const parsed = planningReadinessEvidenceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      outcome: 'BLOCKED',
      blockers: parsed.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'evidence';
        return `${path}: ${issue.message}`;
      }),
    };
  }

  const evidence = parsed.data;
  const blockers: string[] = [];

  requireAcceptedEvidence('Route validation', evidence.routeValidation, blockers);
  if (
    evidence.routeValidation.representativeLaneCount === 0 ||
    evidence.routeValidation.actualOutcomeCount === 0 ||
    !evidence.routeValidation.requestResponseProvenanceComplete
  ) {
    blockers.push('Route validation lacks representative outcomes or complete provenance.');
  }

  requireAcceptedEvidence('Service-time calibration', evidence.serviceTimeCalibration, blockers);
  if (
    evidence.serviceTimeCalibration.completedTripCount === 0 ||
    evidence.serviceTimeCalibration.stopCategories.length === 0 ||
    !evidence.serviceTimeCalibration.assumptionsVersion
  ) {
    blockers.push(
      'Service-time calibration lacks completed-trip evidence or versioned assumptions.'
    );
  }

  requireAcceptedEvidence('Fleet Readiness catalogue', evidence.fleetReadinessCatalogue, blockers);
  if (!evidence.fleetReadinessCatalogue.catalogueComplete) {
    blockers.push('Fleet Readiness fact catalogue is incomplete.');
  }
  if (evidence.fleetReadinessCatalogue.facts.length === 0) {
    blockers.push('Fleet Readiness fact catalogue contains no reviewed facts.');
  }

  requireAcceptedEvidence('Dispatch acceptance', evidence.dispatchAcceptance, blockers);
  if (evidence.dispatchAcceptance.historicalReplayCount === 0) {
    blockers.push('Dispatch acceptance has no historical replay evidence.');
  }
  if (evidence.dispatchAcceptance.hardGateViolations !== 0) {
    blockers.push('Historical replay contains hard-gate violations.');
  }
  if (evidence.dispatchAcceptance.doubleCommitments !== 0) {
    blockers.push('Historical replay contains double commitments.');
  }
  if (
    !evidence.dispatchAcceptance.deterministicMatchingVerified ||
    !evidence.dispatchAcceptance.nominalScenarioPassed ||
    !evidence.dispatchAcceptance.failureScenarioPassed ||
    !evidence.dispatchAcceptance.recoveryScenarioPassed
  ) {
    blockers.push('Dispatch acceptance is missing deterministic or scenario-replay evidence.');
  }

  if (blockers.length > 0) {
    return { outcome: 'BLOCKED', blockers };
  }

  return { outcome: 'EVIDENCE_COMPLETE_REQUIRES_OWNER_ACCEPTANCE', blockers: [] };
}
