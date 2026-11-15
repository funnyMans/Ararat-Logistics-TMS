export type CustomerStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export type CustomerBookingFact =
  | {
      customerId: string;
      result: 'FOUND';
      status: CustomerStatus;
      legalName: string;
      ownerRevision: number;
      registrySequence: number;
      stale: boolean;
      observedOwnerRevision: number;
    }
  | {
      customerId: string;
      result: 'NOT_FOUND';
      registrySequence: number;
      stale: boolean;
      observedOwnerRevision: number;
    };

export type CustomerBookingFactChanged = {
  customerId: string;
  status: CustomerStatus;
  legalName: string;
  ownerRevision: number;
  registrySequence: number;
};

export type CustomerBookingFactSnapshot =
  | {
      customerId: string;
      result: 'FOUND';
      status: CustomerStatus;
      legalName: string;
      ownerRevision: number;
      registrySequence: number;
    }
  | {
      customerId: string;
      result: 'NOT_FOUND';
      registrySequence: number;
    };

export type SnapshotRequestReason =
  'MISSING' | 'REVISION_GAP' | 'REGISTRY_SEQUENCE_GAP' | 'STALE' | 'STREAM_GAP';

export type CustomerBookingSnapshotRequest = {
  customerId: string;
  lastAppliedOwnerRevision: number;
  minimumRegistrySequence: number;
  observedOwnerRevision?: number;
  reason: SnapshotRequestReason;
};

export type CustomerBookingProjectionState = {
  initialized: boolean;
  contiguousRegistrySequence: number;
  observedRegistrySequence: number;
  lastWatermarkSequence: number;
  lastWatermarkAt: number | null;
  streamStale: boolean;
  reconciliationSequence: number | null;
  facts: Record<string, CustomerBookingFact>;
};

export type ProjectionTransition = {
  state: CustomerBookingProjectionState;
  snapshotRequests: CustomerBookingSnapshotRequest[];
};

export function emptyCustomerBookingProjection(): CustomerBookingProjectionState {
  return {
    initialized: false,
    contiguousRegistrySequence: 0,
    observedRegistrySequence: 0,
    lastWatermarkSequence: 0,
    lastWatermarkAt: null,
    streamStale: true,
    reconciliationSequence: null,
    facts: {},
  };
}

function markAllStale(state: CustomerBookingProjectionState): CustomerBookingProjectionState {
  const facts = Object.fromEntries(
    Object.entries(state.facts).map(([customerId, fact]) => [customerId, { ...fact, stale: true }])
  );
  return { ...state, facts, streamStale: true };
}

function makeSnapshotRequest(
  fact: CustomerBookingFact,
  minimumRegistrySequence: number,
  reason: SnapshotRequestReason
): CustomerBookingSnapshotRequest {
  return {
    customerId: fact.customerId,
    lastAppliedOwnerRevision: fact.result === 'FOUND' ? fact.ownerRevision : 0,
    minimumRegistrySequence,
    ...(fact.observedOwnerRevision > 0
      ? { observedOwnerRevision: fact.observedOwnerRevision }
      : {}),
    reason,
  };
}

function beginStreamReconciliation(
  state: CustomerBookingProjectionState,
  registrySequence: number,
  receivedAt: number
): ProjectionTransition {
  const staleState = markAllStale(state);
  const requests = Object.values(staleState.facts).map((fact) =>
    makeSnapshotRequest(fact, registrySequence, 'STREAM_GAP')
  );

  if (requests.length === 0) {
    return {
      state: {
        ...staleState,
        initialized: true,
        contiguousRegistrySequence: registrySequence,
        observedRegistrySequence: Math.max(state.observedRegistrySequence, registrySequence),
        lastWatermarkSequence: registrySequence,
        lastWatermarkAt: receivedAt,
        streamStale: false,
        reconciliationSequence: null,
      },
      snapshotRequests: [],
    };
  }

  return {
    state: {
      ...staleState,
      observedRegistrySequence: Math.max(state.observedRegistrySequence, registrySequence),
      lastWatermarkSequence: registrySequence,
      lastWatermarkAt: receivedAt,
      reconciliationSequence: registrySequence,
    },
    snapshotRequests: requests,
  };
}

function finishReconciliation(
  state: CustomerBookingProjectionState
): CustomerBookingProjectionState {
  const target = state.reconciliationSequence;
  if (target === null) {
    return state;
  }

  const reconciled = Object.values(state.facts).every(
    (fact) => !fact.stale && fact.registrySequence >= target
  );
  if (!reconciled || state.observedRegistrySequence > target) {
    return state;
  }

  return {
    ...state,
    initialized: true,
    contiguousRegistrySequence: target,
    streamStale: false,
    reconciliationSequence: null,
  };
}

export function applyCustomerBookingFact(
  state: CustomerBookingProjectionState,
  event: CustomerBookingFactChanged
): ProjectionTransition {
  const observedRegistrySequence = Math.max(state.observedRegistrySequence, event.registrySequence);

  if (event.registrySequence <= state.contiguousRegistrySequence) {
    return { state: { ...state, observedRegistrySequence }, snapshotRequests: [] };
  }

  if (
    !state.initialized ||
    state.streamStale ||
    event.registrySequence !== state.contiguousRegistrySequence + 1
  ) {
    return {
      state: {
        ...markAllStale(state),
        observedRegistrySequence,
      },
      snapshotRequests: [],
    };
  }

  const previous = state.facts[event.customerId];
  const lastAppliedOwnerRevision = previous?.result === 'FOUND' ? previous.ownerRevision : 0;

  if (event.ownerRevision <= lastAppliedOwnerRevision) {
    return {
      state: {
        ...state,
        contiguousRegistrySequence: event.registrySequence,
        observedRegistrySequence,
      },
      snapshotRequests: [],
    };
  }

  if (event.ownerRevision !== lastAppliedOwnerRevision + 1) {
    const staleFact: CustomerBookingFact = {
      customerId: event.customerId,
      result: 'FOUND',
      status: previous?.result === 'FOUND' ? previous.status : event.status,
      legalName: previous?.result === 'FOUND' ? previous.legalName : event.legalName,
      ownerRevision: lastAppliedOwnerRevision,
      registrySequence: previous?.registrySequence ?? 0,
      stale: true,
      observedOwnerRevision: Math.max(previous?.observedOwnerRevision ?? 0, event.ownerRevision),
    };
    const nextState = {
      ...state,
      facts: { ...state.facts, [event.customerId]: staleFact },
      contiguousRegistrySequence: event.registrySequence,
      observedRegistrySequence,
    };
    return {
      state: nextState,
      snapshotRequests: [makeSnapshotRequest(staleFact, event.registrySequence, 'REVISION_GAP')],
    };
  }

  const fact: CustomerBookingFact = {
    customerId: event.customerId,
    result: 'FOUND',
    status: event.status,
    legalName: event.legalName,
    ownerRevision: event.ownerRevision,
    registrySequence: event.registrySequence,
    stale: false,
    observedOwnerRevision: event.ownerRevision,
  };
  return {
    state: {
      ...state,
      facts: { ...state.facts, [event.customerId]: fact },
      contiguousRegistrySequence: event.registrySequence,
      observedRegistrySequence,
    },
    snapshotRequests: [],
  };
}

export function applyCustomerBookingWatermark(
  state: CustomerBookingProjectionState,
  highWatermarkSequence: number,
  receivedAt: number
): ProjectionTransition {
  if (highWatermarkSequence < state.lastWatermarkSequence) {
    return { state, snapshotRequests: [] };
  }

  const observedRegistrySequence = Math.max(state.observedRegistrySequence, highWatermarkSequence);
  const needsReconciliation =
    !state.initialized ||
    state.streamStale ||
    highWatermarkSequence > state.contiguousRegistrySequence ||
    highWatermarkSequence < state.observedRegistrySequence;

  if (!needsReconciliation) {
    return {
      state: {
        ...state,
        observedRegistrySequence,
        lastWatermarkSequence: highWatermarkSequence,
        lastWatermarkAt: receivedAt,
      },
      snapshotRequests: [],
    };
  }

  if (highWatermarkSequence < state.observedRegistrySequence) {
    return {
      state: {
        ...markAllStale(state),
        observedRegistrySequence,
        lastWatermarkSequence: highWatermarkSequence,
        lastWatermarkAt: receivedAt,
      },
      snapshotRequests: [],
    };
  }

  return beginStreamReconciliation(state, highWatermarkSequence, receivedAt);
}

export function applyCustomerBookingSnapshot(
  state: CustomerBookingProjectionState,
  snapshot: CustomerBookingFactSnapshot,
  minimumRegistrySequence: number
): ProjectionTransition {
  const previous = state.facts[snapshot.customerId];
  const lastAppliedOwnerRevision = previous?.result === 'FOUND' ? previous.ownerRevision : 0;
  const observedOwnerRevision = previous?.observedOwnerRevision ?? 0;

  if (snapshot.registrySequence < minimumRegistrySequence) {
    const request = previous
      ? makeSnapshotRequest(previous, minimumRegistrySequence, 'STALE')
      : {
          customerId: snapshot.customerId,
          lastAppliedOwnerRevision: 0,
          minimumRegistrySequence,
          reason: 'STALE' as const,
        };
    return { state, snapshotRequests: [request] };
  }

  if (
    snapshot.result === 'FOUND' &&
    snapshot.ownerRevision < Math.max(lastAppliedOwnerRevision, observedOwnerRevision)
  ) {
    return {
      state,
      snapshotRequests: [
        makeSnapshotRequest(
          previous ?? {
            customerId: snapshot.customerId,
            result: 'NOT_FOUND',
            registrySequence: 0,
            stale: true,
            observedOwnerRevision: 0,
          },
          minimumRegistrySequence,
          'STALE'
        ),
      ],
    };
  }

  const fact: CustomerBookingFact =
    snapshot.result === 'FOUND'
      ? {
          ...snapshot,
          stale: false,
          observedOwnerRevision: Math.max(observedOwnerRevision, snapshot.ownerRevision),
        }
      : {
          ...snapshot,
          stale: false,
          observedOwnerRevision,
        };
  const nextState = {
    ...state,
    facts: { ...state.facts, [snapshot.customerId]: fact },
  };
  return {
    state: finishReconciliation(nextState),
    snapshotRequests: [],
  };
}

export function expireCustomerBookingWatermark(
  state: CustomerBookingProjectionState,
  now: number,
  maxAgeMs = 30_000
): ProjectionTransition {
  if (state.lastWatermarkAt !== null && now - state.lastWatermarkAt < maxAgeMs) {
    return { state, snapshotRequests: [] };
  }

  if (state.streamStale && Object.values(state.facts).every((fact) => fact.stale)) {
    return { state, snapshotRequests: [] };
  }

  const staleState = markAllStale(state);
  return {
    state: staleState,
    snapshotRequests: Object.values(staleState.facts).map((fact) =>
      makeSnapshotRequest(fact, state.contiguousRegistrySequence, 'STALE')
    ),
  };
}

export function customerBookingFactIsUsable(
  state: CustomerBookingProjectionState,
  customerId: string,
  now: number,
  maxAgeMs = 30_000
): boolean {
  const fact = state.facts[customerId];
  return (
    state.initialized &&
    !state.streamStale &&
    state.lastWatermarkAt !== null &&
    now - state.lastWatermarkAt < maxAgeMs &&
    fact !== undefined &&
    !fact.stale
  );
}
