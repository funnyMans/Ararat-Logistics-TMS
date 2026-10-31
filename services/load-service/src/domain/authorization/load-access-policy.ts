import type { IdentityTokenClaims } from '@app/identity-token';

const loadLeafAreas = new Set([
  'la',
  'pacific',
  'mountain',
  'west_north_central',
  'east_north_central',
  'west_south_central',
  'east_south_central',
  'new_england',
  'middle_atlantic',
  'south_atlantic',
]);

export type LoadResourceAccess = {
  areaId: string;
  handlingBrokerPrincipalId: string;
};

export type BookingArea = {
  areaId: string;
};

export type BookingSubmissionAccess = {
  creatorPrincipalId: string;
  outcome: 'accepted' | 'rejected';
  loadAreas: string[];
};

export class LoadAccessDeniedError extends Error {
  constructor(
    readonly statusCode: 400 | 403 | 404,
    readonly code: 'INVALID_AREA' | 'AREA_ACCESS_DENIED' | 'LOAD_ACCESS_DENIED'
  ) {
    super(code);
    this.name = 'LoadAccessDeniedError';
  }
}

function hasGrant(
  identity: IdentityTokenClaims,
  role: string,
  scopeType: string,
  scopeId: string | null
): boolean {
  return identity.grants.some(
    (grant) => grant.role === role && grant.scopeType === scopeType && grant.scopeId === scopeId
  );
}

function requireLeafArea(areaId: string): void {
  if (!loadLeafAreas.has(areaId)) {
    throw new LoadAccessDeniedError(400, 'INVALID_AREA');
  }
}

function requireBrokerAreas(identity: IdentityTokenClaims, areaIds: string[]): void {
  for (const areaId of new Set(areaIds)) {
    requireLeafArea(areaId);
    if (!hasGrant(identity, 'broker', 'area', areaId)) {
      throw new LoadAccessDeniedError(403, 'AREA_ACCESS_DENIED');
    }
  }
}

function canReadLoad(identity: IdentityTokenClaims, resource: LoadResourceAccess): boolean {
  if (!loadLeafAreas.has(resource.areaId)) {
    return false;
  }

  return (
    (identity.sub === resource.handlingBrokerPrincipalId &&
      hasGrant(identity, 'broker', 'area', resource.areaId)) ||
    hasGrant(identity, 'area_supervisor', 'area', resource.areaId) ||
    hasGrant(identity, 'chief_supervisor', 'company', null) ||
    hasGrant(identity, 'transportation_executive', 'company', null)
  );
}

export const loadAccessPolicy = {
  authorizeBooking(identity: IdentityTokenClaims, rows: BookingArea[]): void {
    if (rows.length === 0) {
      throw new LoadAccessDeniedError(400, 'INVALID_AREA');
    }
    requireBrokerAreas(
      identity,
      rows.map((row) => row.areaId)
    );
  },

  authorizeLoadRead(identity: IdentityTokenClaims, resource: LoadResourceAccess): void {
    if (!canReadLoad(identity, resource)) {
      throw new LoadAccessDeniedError(404, 'LOAD_ACCESS_DENIED');
    }
  },

  authorizeRevisionRead(identity: IdentityTokenClaims, resource: LoadResourceAccess): void {
    loadAccessPolicy.authorizeLoadRead(identity, resource);
  },

  authorizeSubmissionRead(
    identity: IdentityTokenClaims,
    submission: BookingSubmissionAccess
  ): void {
    if (identity.sub === submission.creatorPrincipalId) {
      if (submission.loadAreas.length === 0) {
        throw new LoadAccessDeniedError(404, 'LOAD_ACCESS_DENIED');
      }
      requireBrokerAreas(identity, submission.loadAreas);
      return;
    }

    if (
      submission.outcome === 'accepted' &&
      submission.loadAreas.length > 0 &&
      submission.loadAreas.every((areaId) => {
        return canReadLoad(identity, {
          areaId,
          handlingBrokerPrincipalId: submission.creatorPrincipalId,
        });
      })
    ) {
      return;
    }

    throw new LoadAccessDeniedError(404, 'LOAD_ACCESS_DENIED');
  },

  authorizeCorrection(identity: IdentityTokenClaims, submission: BookingSubmissionAccess): void {
    if (
      submission.outcome !== 'rejected' ||
      identity.sub !== submission.creatorPrincipalId ||
      submission.loadAreas.length === 0
    ) {
      throw new LoadAccessDeniedError(404, 'LOAD_ACCESS_DENIED');
    }
    requireBrokerAreas(identity, submission.loadAreas);
  },
};
