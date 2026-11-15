import { describe, expect, it } from 'vitest';
import { freezePlanningCandidateSnapshot } from '../../src/domain/planning-candidate-snapshot';

const candidate = {
  loadId: 'load-1',
  trioId: 'trio-1',
  sourceRevisions: { load: 'load-rev-3', fleet: 'fleet-rev-8', dispatch: 'prefs-rev-2' },
  hardGates: [
    { gate: 'load-ready', passed: true, failureReason: null },
    { gate: 'fleet-current', passed: true, failureReason: null },
  ],
  dispatcherPreferenceRank: 1,
  systemSuitabilityRank: 2,
};

describe('Dispatch Planning candidate snapshot', () => {
  it('freezes the full attempt and exposes only all-gates-passed pairs as feasible', () => {
    const snapshot = freezePlanningCandidateSnapshot({
      planningAttemptId: 'attempt-1',
      capturedAt: '2026-11-10T12:00:00.000Z',
      candidates: [
        candidate,
        {
          ...candidate,
          loadId: 'load-2',
          trioId: 'trio-2',
          hardGates: [
            { gate: 'load-ready', passed: true, failureReason: null },
            { gate: 'fleet-current', passed: false, failureReason: 'FACT_STALE' },
          ],
          dispatcherPreferenceRank: null,
          systemSuitabilityRank: null,
        },
      ],
    });

    expect(snapshot.candidates).toHaveLength(2);
    expect(snapshot.feasibleCandidates).toEqual([candidate]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.candidates[0])).toBe(true);
    expect(Object.isFrozen(snapshot.candidates[0]?.hardGates)).toBe(true);
  });

  it('rejects duplicate Load/Trio pairs and ranks on failed-gate candidates', () => {
    expect(() =>
      freezePlanningCandidateSnapshot({
        planningAttemptId: 'attempt-1',
        capturedAt: '2026-11-10T12:00:00.000Z',
        candidates: [candidate, candidate],
      })
    ).toThrow(/duplicate candidate pair/);

    expect(() =>
      freezePlanningCandidateSnapshot({
        planningAttemptId: 'attempt-1',
        capturedAt: '2026-11-10T12:00:00.000Z',
        candidates: [
          {
            ...candidate,
            hardGates: [{ gate: 'fleet-current', passed: false, failureReason: 'FACT_STALE' }],
          },
        ],
      })
    ).toThrow();
  });
});
