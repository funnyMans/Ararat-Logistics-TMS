import { z } from 'zod';

const hardGateSchema = z.strictObject({
  gate: z.string().trim().min(1),
  passed: z.boolean(),
  failureReason: z.string().trim().min(1).nullable(),
});

const candidateEvaluationSchema = z
  .strictObject({
    loadId: z.string().trim().min(1),
    trioId: z.string().trim().min(1),
    sourceRevisions: z.record(z.string().trim().min(1), z.string().trim().min(1)),
    hardGates: z.array(hardGateSchema).min(1),
    dispatcherPreferenceRank: z.number().int().positive().nullable(),
    systemSuitabilityRank: z.number().int().positive().nullable(),
  })
  .superRefine((candidate, context) => {
    const gateNames = new Set<string>();
    for (const [index, gate] of candidate.hardGates.entries()) {
      if (gateNames.has(gate.gate)) {
        context.addIssue({
          code: 'custom',
          path: ['hardGates', index, 'gate'],
          message: `Duplicate hard gate "${gate.gate}".`,
        });
      }
      gateNames.add(gate.gate);
      if (gate.passed === (gate.failureReason !== null)) {
        context.addIssue({
          code: 'custom',
          path: ['hardGates', index, 'failureReason'],
          message: 'A passed gate must have no failure reason; a failed gate must include one.',
        });
      }
    }

    const feasible = candidate.hardGates.every((gate) => gate.passed);
    const hasRanks =
      candidate.dispatcherPreferenceRank !== null && candidate.systemSuitabilityRank !== null;
    if (feasible !== hasRanks) {
      context.addIssue({
        code: 'custom',
        message: 'Only feasible candidates may include both ranking values.',
      });
    }
    if (Object.keys(candidate.sourceRevisions).length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['sourceRevisions'],
        message: 'At least one source revision is required for an auditable candidate.',
      });
    }
  });

const planningCandidateSnapshotSchema = z.strictObject({
  planningAttemptId: z.string().trim().min(1),
  capturedAt: z.iso.datetime({ offset: true }),
  candidates: z.array(candidateEvaluationSchema),
});

type ParsedPlanningCandidateEvaluation = z.infer<typeof candidateEvaluationSchema>;
export type PlanningCandidateEvaluation = Readonly<
  Omit<ParsedPlanningCandidateEvaluation, 'sourceRevisions' | 'hardGates'> & {
    sourceRevisions: Readonly<Record<string, string>>;
    hardGates: readonly Readonly<z.infer<typeof hardGateSchema>>[];
  }
>;
export type PlanningCandidateSnapshot = Readonly<{
  planningAttemptId: string;
  capturedAt: string;
  candidates: readonly PlanningCandidateEvaluation[];
  feasibleCandidates: readonly PlanningCandidateEvaluation[];
}>;

function freezeCandidate(
  candidate: ParsedPlanningCandidateEvaluation
): PlanningCandidateEvaluation {
  return Object.freeze({
    ...candidate,
    sourceRevisions: Object.freeze({ ...candidate.sourceRevisions }),
    hardGates: Object.freeze(candidate.hardGates.map((gate) => Object.freeze({ ...gate }))),
  });
}

export function freezePlanningCandidateSnapshot(input: unknown): PlanningCandidateSnapshot {
  const parsed = planningCandidateSnapshotSchema.parse(input);
  const sortedCandidates = [...parsed.candidates].sort((left, right) => {
    if (left.loadId !== right.loadId) {
      return left.loadId < right.loadId ? -1 : 1;
    }
    if (left.trioId === right.trioId) {
      return 0;
    }
    return left.trioId < right.trioId ? -1 : 1;
  });
  const seenPairs = new Set<string>();
  const candidates = sortedCandidates.map((candidate) => {
    const pair = JSON.stringify([candidate.loadId, candidate.trioId]);
    if (seenPairs.has(pair)) {
      throw new Error(
        `Planning attempt contains duplicate candidate pair (${candidate.loadId}, ${candidate.trioId}).`
      );
    }
    seenPairs.add(pair);
    return freezeCandidate(candidate);
  });
  const feasibleCandidates = candidates.filter((candidate) =>
    candidate.hardGates.every((gate) => gate.passed)
  );

  return Object.freeze({
    planningAttemptId: parsed.planningAttemptId,
    capturedAt: parsed.capturedAt,
    candidates: Object.freeze(candidates),
    feasibleCandidates: Object.freeze(feasibleCandidates),
  });
}
