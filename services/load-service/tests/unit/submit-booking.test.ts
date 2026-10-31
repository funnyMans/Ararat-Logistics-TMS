import { describe, expect, it, vi } from 'vitest';
import type { IdentityTokenClaims } from '@app/identity-token';
import {
  BookingCorrectionNotFoundError,
  CustomerStatusUnavailableError,
  InvalidBookingAreaError,
  SubmitBooking,
} from '../../src/application/commands/submit-booking';
import type { BookingSubmissionAccess } from '../../src/domain/authorization/load-access-policy';
import type {
  LoadBookingSubmissionRepository,
  LoadCustomerBookingFactReader,
  LoadPickupAreaResolver,
} from '../../src/application/ports/load-booking-ports';

const customerId = '018f47a2-7b3c-7abc-8def-123456789abc';

const brokerIdentity: IdentityTokenClaims = {
  iss: 'https://identity.example.test',
  aud: 'tms-api',
  sub: 'broker-1',
  iat: 1,
  exp: 2,
  jti: 'token-1',
  sid: 'session-1',
  auth_time: 1,
  amr: ['pwd', 'otp'],
  grantVersion: 1,
  grants: [{ role: 'broker', scopeType: 'area', scopeId: 'la' }],
};

const rejectedSubmission = {
  creatorPrincipalId: 'broker-1',
  outcome: 'rejected' as const,
  loadAreas: ['la'],
};

function createSut(
  resolvedAreas: Array<string | null> = ['la'],
  correction: BookingSubmissionAccess | null = rejectedSubmission,
  customerLookup: Awaited<
    ReturnType<LoadCustomerBookingFactReader['getUsableOrRequestReconciliation']>
  > = {
    available: true,
    fact: {
      result: 'FOUND',
      status: 'ACTIVE',
      legalName: 'Customer One',
      ownerRevision: 1,
      registrySequence: 1,
    },
  }
) {
  const areaResolver: LoadPickupAreaResolver = {
    resolveFirstPickupAreas: vi.fn(async () => resolvedAreas),
  };
  const repository: LoadBookingSubmissionRepository = {
    findSubmission: vi.fn(async () => correction),
    createSubmission: vi.fn(async (_identity, _request, _areaIds, _customerFacts) => ({
      submissionId: 'submission-1',
      replayed: false,
      representation: { status: 'accepted' },
    })),
  };
  const customerFacts: LoadCustomerBookingFactReader = {
    getUsableOrRequestReconciliation: vi.fn(async () => customerLookup),
  };
  return {
    submitBooking: new SubmitBooking(areaResolver, repository, customerFacts),
    areaResolver,
    repository,
    customerFacts,
  };
}

describe('SubmitBooking authorization', () => {
  it('derives areas before authorization and submits only after all grants pass', async () => {
    const { submitBooking, areaResolver, repository } = createSut(['la', 'pacific']);
    const request = { idempotencyKey: 'key-1', rows: [{}, {}] };

    await expect(submitBooking.execute(brokerIdentity, request)).rejects.toMatchObject({
      statusCode: 403,
      code: 'AREA_ACCESS_DENIED',
    });
    expect(areaResolver.resolveFirstPickupAreas).toHaveBeenCalledWith(request.rows);
    expect(repository.createSubmission).not.toHaveBeenCalled();
  });

  it('rejects a caller-supplied area that conflicts with the resolved pickup area', async () => {
    const { submitBooking, repository } = createSut(['la']);

    await expect(
      submitBooking.execute(brokerIdentity, {
        idempotencyKey: 'key-1',
        rows: [{ areaId: 'pacific' }],
      })
    ).rejects.toBeInstanceOf(InvalidBookingAreaError);
    expect(repository.createSubmission).not.toHaveBeenCalled();
  });

  it('requires the caller to own a rejected correction and its original areas', async () => {
    const { submitBooking, repository } = createSut(['la'], {
      ...rejectedSubmission,
      creatorPrincipalId: 'broker-2',
    });

    await expect(
      submitBooking.execute(brokerIdentity, {
        idempotencyKey: 'key-1',
        rows: [{}],
        correctionOfSubmissionId: 'submission-1',
      })
    ).rejects.toMatchObject({ statusCode: 404, code: 'LOAD_ACCESS_DENIED' });
    expect(repository.findSubmission).toHaveBeenCalledWith('submission-1');
    expect(repository.createSubmission).not.toHaveBeenCalled();
  });

  it('returns not found for a correction target that does not exist', async () => {
    const { submitBooking } = createSut(['la'], null);

    await expect(
      submitBooking.execute(brokerIdentity, {
        idempotencyKey: 'key-1',
        rows: [{}],
        correctionOfSubmissionId: 'missing-submission',
      })
    ).rejects.toBeInstanceOf(BookingCorrectionNotFoundError);
  });

  it('fails explicitly when the geography adapter returns an incomplete result', async () => {
    const { submitBooking, repository } = createSut([]);

    await expect(
      submitBooking.execute(brokerIdentity, { idempotencyKey: 'key-1', rows: [{}] })
    ).rejects.toThrow('The pickup area resolver returned an incomplete result.');
    expect(repository.createSubmission).not.toHaveBeenCalled();
  });

  it('rejects rows whose pickup geography cannot be resolved', async () => {
    const { submitBooking, repository } = createSut([null]);

    await expect(
      submitBooking.execute(brokerIdentity, { idempotencyKey: 'key-1', rows: [{}] })
    ).rejects.toBeInstanceOf(InvalidBookingAreaError);
    expect(repository.createSubmission).not.toHaveBeenCalled();
  });

  it('persists after authorization when the resolved leaf is granted', async () => {
    const { submitBooking, repository } = createSut(['la']);
    const request = { idempotencyKey: 'key-1', rows: [{ areaId: 'la' }] };

    await expect(submitBooking.execute(brokerIdentity, request)).resolves.toEqual({
      submissionId: 'submission-1',
      replayed: false,
      representation: { status: 'accepted' },
    });
    expect(repository.createSubmission).toHaveBeenCalledWith(brokerIdentity, request, ['la'], {});
  });

  it('looks up each distinct UUIDv7 Customer only after authorization', async () => {
    const { submitBooking, customerFacts, repository } = createSut(['la', 'la']);
    const request = {
      idempotencyKey: 'key-1',
      rows: [{ customerId }, { customerId }],
    };

    await submitBooking.execute(brokerIdentity, request);

    expect(customerFacts.getUsableOrRequestReconciliation).toHaveBeenCalledTimes(1);
    expect(customerFacts.getUsableOrRequestReconciliation).toHaveBeenCalledWith(customerId);
    expect(repository.createSubmission).toHaveBeenCalledWith(
      brokerIdentity,
      request,
      ['la', 'la'],
      {
        [customerId]: {
          result: 'FOUND',
          status: 'ACTIVE',
          legalName: 'Customer One',
          ownerRevision: 1,
          registrySequence: 1,
        },
      }
    );
  });

  it('fails closed without creating a submission when the Customer fact is unavailable', async () => {
    const { submitBooking, repository, customerFacts } = createSut(['la'], rejectedSubmission, {
      available: false,
    });

    await expect(
      submitBooking.execute(brokerIdentity, {
        idempotencyKey: 'key-1',
        rows: [{ customerId }],
      })
    ).rejects.toBeInstanceOf(CustomerStatusUnavailableError);
    expect(customerFacts.getUsableOrRequestReconciliation).toHaveBeenCalledWith(customerId);
    expect(repository.createSubmission).not.toHaveBeenCalled();
  });

  it('passes authoritative not-found and inactive facts to durable submission evaluation', async () => {
    const { submitBooking, repository } = createSut(['la'], rejectedSubmission, {
      available: true,
      fact: { result: 'NOT_FOUND', registrySequence: 4 },
    });
    const request = { idempotencyKey: 'key-1', rows: [{ customerId }] };

    await submitBooking.execute(brokerIdentity, request);

    expect(repository.createSubmission).toHaveBeenCalledWith(brokerIdentity, request, ['la'], {
      [customerId]: { result: 'NOT_FOUND', registrySequence: 4 },
    });
  });

  it('does not request a Registry lookup for malformed identifiers', async () => {
    const { submitBooking, customerFacts, repository } = createSut();
    const request = { idempotencyKey: 'key-1', rows: [{ customerId: 'not-a-uuid' }] };

    await submitBooking.execute(brokerIdentity, request);

    expect(customerFacts.getUsableOrRequestReconciliation).not.toHaveBeenCalled();
    expect(repository.createSubmission).toHaveBeenCalledWith(brokerIdentity, request, ['la'], {});
  });
});
