import { randomUUIDv7 } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  capacityCommitmentCommandSchema,
  findOverlappingSegmentResources,
  type CapacitySegment,
} from '../../src/interfaces/messaging/capacity-commitment-messages';

function makeSegment(
  sequenceNumber = 1,
  startAt = '2026-11-03T08:00:00.000Z',
  endAt = '2026-11-03T10:00:00.000Z'
): CapacitySegment {
  const powerUnitId = randomUUIDv7();
  const trailerId = randomUUIDv7();
  const driverId = randomUUIDv7();
  return {
    sequenceNumber,
    startStopId: randomUUIDv7(),
    endStopId: randomUUIDv7(),
    timeWindow: { startAt, endAt },
    powerUnitId,
    trailerId,
    driverIds: [driverId],
    resourceReadinessRevisions: [
      { resourceType: 'POWER_UNIT', resourceId: powerUnitId, ownerRevision: 1 },
      { resourceType: 'TRAILER', resourceId: trailerId, ownerRevision: 2 },
      { resourceType: 'DRIVER', resourceId: driverId, ownerRevision: 3 },
    ],
  };
}

function makeReserveCommand(segments: CapacitySegment[]) {
  return {
    messageId: randomUUIDv7(),
    messageType: 'capacity.reservation.reserve',
    schemaVersion: '1.0.0',
    sourceService: 'dispatch-planning',
    targetService: 'capacity-commitment',
    issuedAt: '2026-11-03T07:00:00.000Z',
    correlationId: randomUUIDv7(),
    commandId: randomUUIDv7(),
    idempotencyKey: 'attempt-1',
    payload: {
      planningAttemptId: randomUUIDv7(),
      tripPlanId: randomUUIDv7(),
      tripPlanRevision: 1,
      segments,
    },
  };
}

describe('Capacity Commitment message validation', () => {
  it('accepts a complete reservation command with exact resource revisions', () => {
    const parsed = capacityCommitmentCommandSchema.safeParse(makeReserveCommand([makeSegment()]));

    expect(parsed.success).toBe(true);
  });

  it('rejects segments whose sequence numbers are not contiguous and ordered', () => {
    const parsed = capacityCommitmentCommandSchema.safeParse(
      makeReserveCommand([makeSegment(1), makeSegment(3)])
    );

    expect(parsed.success).toBe(false);
  });

  it('rejects segments without a readiness revision for every assigned resource', () => {
    const segment = makeSegment();
    segment.resourceReadinessRevisions.pop();

    const parsed = capacityCommitmentCommandSchema.safeParse(makeReserveCommand([segment]));

    expect(parsed.success).toBe(false);
  });

  it('detects overlapping windows for the same resource but permits touching half-open windows', () => {
    const first = makeSegment(1, '2026-11-03T08:00:00.000Z', '2026-11-03T10:00:00.000Z');
    const second = makeSegment(2, '2026-11-03T09:00:00.000Z', '2026-11-03T11:00:00.000Z');
    const touching = makeSegment(2, '2026-11-03T10:00:00.000Z', '2026-11-03T11:00:00.000Z');
    second.powerUnitId = first.powerUnitId;
    second.resourceReadinessRevisions[0] = {
      resourceType: 'POWER_UNIT',
      resourceId: first.powerUnitId,
      ownerRevision: 1,
    };
    touching.powerUnitId = first.powerUnitId;
    touching.resourceReadinessRevisions[0] = {
      resourceType: 'POWER_UNIT',
      resourceId: first.powerUnitId,
      ownerRevision: 1,
    };

    expect(findOverlappingSegmentResources([first, second])).toEqual([
      {
        sequenceNumber: 2,
        resourceType: 'POWER_UNIT',
        resourceId: first.powerUnitId,
      },
    ]);
    expect(findOverlappingSegmentResources([first, touching])).toEqual([]);
  });
});
