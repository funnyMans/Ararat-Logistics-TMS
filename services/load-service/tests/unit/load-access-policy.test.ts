import { describe, expect, it } from 'vitest';
import type { IdentityTokenClaims } from '@app/identity-token';
import {
  LoadAccessDeniedError,
  loadAccessPolicy,
} from '../../src/domain/authorization/load-access-policy';

function identity(sub: string, grants: IdentityTokenClaims['grants']): IdentityTokenClaims {
  return {
    iss: 'https://identity.example.test',
    aud: 'tms-api',
    sub,
    iat: 1,
    exp: 2,
    jti: 'token-1',
    sid: 'session-1',
    auth_time: 1,
    amr: ['pwd', 'otp'],
    grantVersion: 1,
    grants,
  };
}

function expectDenied(
  operation: () => void,
  statusCode: 400 | 403 | 404,
  code: LoadAccessDeniedError['code']
): void {
  try {
    operation();
    throw new Error('Expected authorization to be denied');
  } catch (error) {
    expect(error).toBeInstanceOf(LoadAccessDeniedError);
    expect(error).toMatchObject({ statusCode, code });
  }
}

describe('Load D-513 access policy', () => {
  it('requires broker grants for every valid area in a multi-row booking', () => {
    const broker = identity('broker-1', [
      { role: 'broker', scopeType: 'area', scopeId: 'la' },
      { role: 'broker', scopeType: 'area', scopeId: 'pacific' },
    ]);

    expect(() =>
      loadAccessPolicy.authorizeBooking(broker, [{ areaId: 'la' }, { areaId: 'pacific' }])
    ).not.toThrow();
    expectDenied(
      () =>
        loadAccessPolicy.authorizeBooking(broker, [
          { areaId: 'la' },
          { areaId: 'east_north_central' },
        ]),
      403,
      'AREA_ACCESS_DENIED'
    );
  });

  it('rejects reporting rollups and empty booking batches', () => {
    const broker = identity('broker-1', [{ role: 'broker', scopeType: 'area', scopeId: 'la' }]);

    expectDenied(
      () => loadAccessPolicy.authorizeBooking(broker, [{ areaId: 'west' }]),
      400,
      'INVALID_AREA'
    );
    expectDenied(() => loadAccessPolicy.authorizeBooking(broker, []), 400, 'INVALID_AREA');
  });

  it('restricts broker reads to their own Loads and granted areas', () => {
    const broker = identity('broker-1', [{ role: 'broker', scopeType: 'area', scopeId: 'la' }]);
    const ownLoad = { areaId: 'la', handlingBrokerPrincipalId: 'broker-1' };

    expect(() => loadAccessPolicy.authorizeLoadRead(broker, ownLoad)).not.toThrow();
    expectDenied(
      () =>
        loadAccessPolicy.authorizeLoadRead(broker, {
          areaId: 'la',
          handlingBrokerPrincipalId: 'broker-2',
        }),
      404,
      'LOAD_ACCESS_DENIED'
    );
  });

  it('applies leaf grants to area supervisors and company grants to company-wide readers', () => {
    const areaSupervisor = identity('supervisor-1', [
      { role: 'area_supervisor', scopeType: 'area', scopeId: 'la' },
    ]);
    const companyReader = identity('executive-1', [
      { role: 'transportation_executive', scopeType: 'company', scopeId: null },
    ]);
    const load = { areaId: 'la', handlingBrokerPrincipalId: 'broker-1' };

    expect(() => loadAccessPolicy.authorizeLoadRead(areaSupervisor, load)).not.toThrow();
    expect(() => loadAccessPolicy.authorizeLoadRead(companyReader, load)).not.toThrow();
  });

  it('conceals missing authority for submission and revision reads', () => {
    const otherBroker = identity('broker-2', [
      { role: 'broker', scopeType: 'area', scopeId: 'la' },
    ]);
    const submission = {
      creatorPrincipalId: 'broker-1',
      outcome: 'rejected' as const,
      loadAreas: ['la'],
    };

    expectDenied(
      () => loadAccessPolicy.authorizeSubmissionRead(otherBroker, submission),
      404,
      'LOAD_ACCESS_DENIED'
    );
    expectDenied(
      () =>
        loadAccessPolicy.authorizeRevisionRead(otherBroker, {
          areaId: 'la',
          handlingBrokerPrincipalId: 'broker-1',
        }),
      404,
      'LOAD_ACCESS_DENIED'
    );
  });

  it('fails closed when a stored submission has no authorization areas', () => {
    const creator = identity('broker-1', []);
    const submission = {
      creatorPrincipalId: 'broker-1',
      outcome: 'rejected' as const,
      loadAreas: [],
    };

    expectDenied(
      () => loadAccessPolicy.authorizeSubmissionRead(creator, submission),
      404,
      'LOAD_ACCESS_DENIED'
    );
    expectDenied(
      () => loadAccessPolicy.authorizeCorrection(creator, submission),
      404,
      'LOAD_ACCESS_DENIED'
    );
  });

  it('allows the creator to read a complete outcome and correct only their rejected submission', () => {
    const creator = identity('broker-1', [
      { role: 'broker', scopeType: 'area', scopeId: 'la' },
      { role: 'broker', scopeType: 'area', scopeId: 'pacific' },
    ]);
    const rejected = {
      creatorPrincipalId: 'broker-1',
      outcome: 'rejected' as const,
      loadAreas: ['la', 'pacific'],
    };

    expect(() => loadAccessPolicy.authorizeSubmissionRead(creator, rejected)).not.toThrow();
    expect(() => loadAccessPolicy.authorizeCorrection(creator, rejected)).not.toThrow();
    expectDenied(
      () =>
        loadAccessPolicy.authorizeCorrection(creator, {
          ...rejected,
          outcome: 'accepted',
        }),
      404,
      'LOAD_ACCESS_DENIED'
    );
  });

  it('allows another actor to read an accepted result only when they can read every Load', () => {
    const areaSupervisor = identity('supervisor-1', [
      { role: 'area_supervisor', scopeType: 'area', scopeId: 'la' },
      { role: 'area_supervisor', scopeType: 'area', scopeId: 'pacific' },
    ]);
    const accepted = {
      creatorPrincipalId: 'broker-1',
      outcome: 'accepted' as const,
      loadAreas: ['la', 'pacific'],
    };

    expect(() => loadAccessPolicy.authorizeSubmissionRead(areaSupervisor, accepted)).not.toThrow();
    expectDenied(
      () =>
        loadAccessPolicy.authorizeSubmissionRead(
          identity('supervisor-1', [{ role: 'area_supervisor', scopeType: 'area', scopeId: 'la' }]),
          accepted
        ),
      404,
      'LOAD_ACCESS_DENIED'
    );
  });
});
