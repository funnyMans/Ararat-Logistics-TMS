import { describe, expect, it } from 'vitest';
import {
  applyCustomerBookingFact,
  applyCustomerBookingSnapshot,
  applyCustomerBookingWatermark,
  customerBookingFactIsUsable,
  emptyCustomerBookingProjection,
  expireCustomerBookingWatermark,
} from '../../src/domain/customer-booking/customer-booking-projection';

const customerId = '018f47a2-7b3c-7abc-8def-123456789abc';
const secondCustomerId = '018f47a2-7b3c-7abc-8def-123456789abd';

function initializedProjection() {
  return applyCustomerBookingWatermark(emptyCustomerBookingProjection(), 0, 1_000).state;
}

function fact(
  customerId: string,
  registrySequence: number,
  ownerRevision: number,
  status: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE'
) {
  return {
    customerId,
    status,
    legalName: `Customer ${customerId}`,
    ownerRevision,
    registrySequence,
  } as const;
}

describe('Customer booking fact projection', () => {
  it('initializes an empty projection only after observing a completeness watermark', () => {
    const initial = emptyCustomerBookingProjection();
    expect(initial.initialized).toBe(false);
    expect(customerBookingFactIsUsable(initial, customerId, 1_000)).toBe(false);

    const transition = applyCustomerBookingWatermark(initial, 0, 1_000);

    expect(transition.state.initialized).toBe(true);
    expect(transition.state.contiguousRegistrySequence).toBe(0);
    expect(transition.state.streamStale).toBe(false);
    expect(transition.state.lastWatermarkAt).toBe(1_000);
  });

  it('applies contiguous revisions and ignores duplicate and older registry sequences', () => {
    const initial = initializedProjection();
    const first = applyCustomerBookingFact(initial, fact(customerId, 1, 1));
    const duplicate = applyCustomerBookingFact(first.state, fact(customerId, 1, 1, 'SUSPENDED'));
    const second = applyCustomerBookingFact(duplicate.state, fact(customerId, 2, 2, 'SUSPENDED'));

    expect(duplicate.state.facts[customerId]).toMatchObject({
      status: 'ACTIVE',
      ownerRevision: 1,
    });
    expect(second.state.facts[customerId]).toMatchObject({
      status: 'SUSPENDED',
      ownerRevision: 2,
      registrySequence: 2,
      stale: false,
    });
    expect(second.state.contiguousRegistrySequence).toBe(2);
  });

  it('marks all known facts stale on a registry sequence gap and waits for a watermark', () => {
    const initial = initializedProjection();
    const first = applyCustomerBookingFact(initial, fact(customerId, 1, 1));
    const second = applyCustomerBookingFact(first.state, fact(secondCustomerId, 2, 1));
    const gap = applyCustomerBookingFact(second.state, fact(customerId, 4, 2));

    expect(gap.state.contiguousRegistrySequence).toBe(2);
    expect(gap.state.observedRegistrySequence).toBe(4);
    expect(gap.state.streamStale).toBe(true);
    expect(gap.state.facts[customerId].stale).toBe(true);
    expect(gap.state.facts[secondCustomerId].stale).toBe(true);
    expect(gap.snapshotRequests).toEqual([]);

    const watermark = applyCustomerBookingWatermark(gap.state, 4, 2_000);
    expect(watermark.snapshotRequests).toHaveLength(2);
    expect(watermark.snapshotRequests[0]).toMatchObject({
      minimumRegistrySequence: 4,
      reason: 'STREAM_GAP',
    });
    expect(watermark.state.contiguousRegistrySequence).toBe(2);
  });

  it('advances the stream cursor only when every existing projection reconciles through watermark', () => {
    const initial = initializedProjection();
    const first = applyCustomerBookingFact(initial, fact(customerId, 1, 1));
    const second = applyCustomerBookingFact(first.state, fact(secondCustomerId, 2, 1));
    const watermark = applyCustomerBookingWatermark(second.state, 3, 2_000);

    expect(watermark.state.contiguousRegistrySequence).toBe(2);
    expect(watermark.state.reconciliationSequence).toBe(3);

    const oneSnapshot = applyCustomerBookingSnapshot(
      watermark.state,
      {
        customerId,
        result: 'FOUND',
        status: 'ACTIVE',
        legalName: 'Customer One',
        ownerRevision: 2,
        registrySequence: 3,
      },
      3
    );
    expect(oneSnapshot.state.contiguousRegistrySequence).toBe(2);
    expect(oneSnapshot.state.streamStale).toBe(true);

    const finalSnapshot = applyCustomerBookingSnapshot(
      oneSnapshot.state,
      {
        customerId: secondCustomerId,
        result: 'FOUND',
        status: 'ACTIVE',
        legalName: 'Customer Two',
        ownerRevision: 1,
        registrySequence: 3,
      },
      3
    );

    expect(finalSnapshot.state.contiguousRegistrySequence).toBe(3);
    expect(finalSnapshot.state.initialized).toBe(true);
    expect(finalSnapshot.state.streamStale).toBe(false);
    expect(finalSnapshot.state.reconciliationSequence).toBeNull();
  });

  it('keeps a customer stale and requests another snapshot when owner revision is skipped', () => {
    const initial = initializedProjection();
    const first = applyCustomerBookingFact(initial, fact(customerId, 1, 1));
    const skipped = applyCustomerBookingFact(first.state, fact(customerId, 2, 3));

    expect(skipped.state.contiguousRegistrySequence).toBe(2);
    expect(skipped.state.facts[customerId]).toMatchObject({
      ownerRevision: 1,
      observedOwnerRevision: 3,
      stale: true,
    });
    expect(skipped.snapshotRequests).toEqual([
      {
        customerId,
        lastAppliedOwnerRevision: 1,
        observedOwnerRevision: 3,
        minimumRegistrySequence: 2,
        reason: 'REVISION_GAP',
      },
    ]);

    const snapshot = applyCustomerBookingSnapshot(
      skipped.state,
      {
        customerId,
        result: 'FOUND',
        status: 'ACTIVE',
        legalName: 'Current Name',
        ownerRevision: 3,
        registrySequence: 2,
      },
      2
    );
    expect(snapshot.state.facts[customerId]).toMatchObject({
      ownerRevision: 3,
      stale: false,
      legalName: 'Current Name',
    });
    expect(snapshot.state.streamStale).toBe(false);
  });

  it('rejects a snapshot below required sequence or observed owner revision', () => {
    const initial = initializedProjection();
    const first = applyCustomerBookingFact(initial, fact(customerId, 1, 1));
    const gap = applyCustomerBookingFact(first.state, fact(customerId, 2, 3));
    const staleSnapshot = applyCustomerBookingSnapshot(
      gap.state,
      {
        customerId,
        result: 'FOUND',
        status: 'ACTIVE',
        legalName: 'Old Name',
        ownerRevision: 2,
        registrySequence: 1,
      },
      2
    );

    expect(staleSnapshot.state.facts[customerId].stale).toBe(true);
    expect(staleSnapshot.snapshotRequests).toHaveLength(1);
    expect(staleSnapshot.snapshotRequests[0]).toMatchObject({
      minimumRegistrySequence: 2,
      observedOwnerRevision: 3,
      reason: 'STALE',
    });
  });

  it('persists authoritative not-found snapshots as fresh owner results', () => {
    const initial = initializedProjection();
    const result = applyCustomerBookingSnapshot(
      initial,
      { customerId, result: 'NOT_FOUND', registrySequence: 0 },
      0
    );

    expect(result.state.facts[customerId]).toMatchObject({
      result: 'NOT_FOUND',
      stale: false,
      registrySequence: 0,
    });
  });

  it('does not reopen booking when an event beyond the recovery watermark was observed', () => {
    const initial = initializedProjection();
    const first = applyCustomerBookingFact(initial, fact(customerId, 1, 1));
    const watermark = applyCustomerBookingWatermark(first.state, 3, 2_000);
    const laterEvent = applyCustomerBookingFact(watermark.state, fact(customerId, 4, 3));
    const behindSnapshot = applyCustomerBookingSnapshot(
      laterEvent.state,
      {
        customerId,
        result: 'FOUND',
        status: 'ACTIVE',
        legalName: 'Customer One',
        ownerRevision: 2,
        registrySequence: 3,
      },
      3
    );

    expect(behindSnapshot.state.contiguousRegistrySequence).toBe(1);
    expect(behindSnapshot.state.streamStale).toBe(true);

    const nextWatermark = applyCustomerBookingWatermark(behindSnapshot.state, 4, 3_000);
    expect(nextWatermark.state.reconciliationSequence).toBe(4);
    const currentSnapshot = applyCustomerBookingSnapshot(
      nextWatermark.state,
      {
        customerId,
        result: 'FOUND',
        status: 'SUSPENDED',
        legalName: 'Customer One',
        ownerRevision: 3,
        registrySequence: 4,
      },
      4
    );

    expect(currentSnapshot.state.contiguousRegistrySequence).toBe(4);
    expect(currentSnapshot.state.streamStale).toBe(false);
  });

  it('stales every existing fact after 30 seconds without a watermark', () => {
    const initial = initializedProjection();
    const first = applyCustomerBookingFact(initial, fact(customerId, 1, 1));
    expect(customerBookingFactIsUsable(first.state, customerId, 30_999)).toBe(true);

    const expired = expireCustomerBookingWatermark(first.state, 31_000);

    expect(expired.state.streamStale).toBe(true);
    expect(expired.state.facts[customerId].stale).toBe(true);
    expect(customerBookingFactIsUsable(expired.state, customerId, 31_000)).toBe(false);
    expect(expired.snapshotRequests).toMatchObject([
      {
        customerId,
        minimumRegistrySequence: 1,
        reason: 'STALE',
      },
    ]);
  });
});
