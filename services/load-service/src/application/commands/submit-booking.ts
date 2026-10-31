import type { IdentityTokenClaims } from '@app/identity-token';
import { LoadAccessAuthorizer } from '../authorization/load-access-authorizer';
import type {
  CustomerBookingFactResult,
  LoadCustomerBookingFactReader,
  LoadBookingSubmissionRepository,
  LoadPickupGeographyResolver,
} from '../ports/load-booking-ports';
import type { LoadBookingSubmissionRequest } from '../ports/load-booking-ports';
import { deriveLoadOperatingArea } from '../../domain/authorization/load-operating-area';

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InvalidBookingAreaError extends Error {
  constructor() {
    super('The first pickup location could not be assigned to its asserted booking area.');
    this.name = 'InvalidBookingAreaError';
  }
}

export class CustomerStatusUnavailableError extends Error {
  constructor() {
    super('Current Customer status could not be verified.');
    this.name = 'CustomerStatusUnavailableError';
  }
}

export class InvalidBookingSubmissionError extends Error {
  constructor() {
    super('A booking submission requires 1-100 rows and a valid Idempotency-Key.');
    this.name = 'InvalidBookingSubmissionError';
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super('The Idempotency-Key was already used with different booking content.');
    this.name = 'IdempotencyConflictError';
  }
}

export class BookingCorrectionNotFoundError extends Error {
  constructor() {
    super('The rejected booking submission was not found.');
    this.name = 'BookingCorrectionNotFoundError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class SubmitBooking {
  constructor(
    private readonly pickupGeographyResolver: LoadPickupGeographyResolver,
    private readonly repository: LoadBookingSubmissionRepository,
    private readonly customerFacts: LoadCustomerBookingFactReader,
    private readonly authorizer = new LoadAccessAuthorizer()
  ) {}

  async execute(identity: IdentityTokenClaims, request: LoadBookingSubmissionRequest) {
    if (
      request.rows.length === 0 ||
      request.rows.length > 100 ||
      request.idempotencyKey.length === 0 ||
      request.idempotencyKey.length > 255 ||
      (request.correctionOfSubmissionId !== undefined &&
        request.correctionOfSubmissionId !== null &&
        !UUID_V7_PATTERN.test(request.correctionOfSubmissionId))
    ) {
      throw new InvalidBookingSubmissionError();
    }

    const existing = await this.repository.findIdempotentSubmission(identity, request);
    if (existing) {
      this.authorizer.authorizeSubmissionRead(identity, existing.authorization);
      return existing.result;
    }

    const resolvedGeographies = await this.pickupGeographyResolver.resolveFirstPickupGeographies(
      request.rows
    );
    if (!Array.isArray(resolvedGeographies) || resolvedGeographies.length !== request.rows.length) {
      throw new Error('The pickup geocoder returned an incomplete result.');
    }

    const areaIds: string[] = [];
    const areaMappingRevisions: string[] = [];
    for (const geography of resolvedGeographies) {
      const area = geography ? deriveLoadOperatingArea(geography) : null;
      if (!area) {
        throw new InvalidBookingAreaError();
      }
      areaIds.push(area.areaId);
      areaMappingRevisions.push(area.mappingRevision);
    }

    for (const [index, row] of request.rows.entries()) {
      if (
        isRecord(row) &&
        row.areaId !== undefined &&
        row.areaId !== null &&
        row.areaId !== areaIds[index]
      ) {
        throw new InvalidBookingAreaError();
      }
    }

    this.authorizer.authorizeBooking(
      identity,
      areaIds.map((areaId) => ({ areaId }))
    );

    if (
      request.correctionOfSubmissionId !== undefined &&
      request.correctionOfSubmissionId !== null
    ) {
      const original = await this.repository.findSubmission(request.correctionOfSubmissionId);
      if (!original) {
        throw new BookingCorrectionNotFoundError();
      }
      this.authorizer.authorizeCorrection(identity, original);
    }

    const customerFactResults: Record<string, CustomerBookingFactResult> = {};
    for (const customerId of new Set(
      request.rows.flatMap((row) => {
        if (!isRecord(row) || typeof row.customerId !== 'string') {
          return [];
        }
        const customerId = row.customerId.trim();
        return UUID_V7_PATTERN.test(customerId) ? [customerId.toLowerCase()] : [];
      })
    )) {
      const lookup = await this.customerFacts.getUsableOrRequestReconciliation(customerId);
      if (!lookup.available) {
        throw new CustomerStatusUnavailableError();
      }
      customerFactResults[customerId] = lookup.fact;
    }

    const result = await this.repository.createSubmission(
      identity,
      request,
      areaIds,
      areaMappingRevisions,
      customerFactResults
    );
    if (result.replayed) {
      const authorization = await this.repository.findSubmission(result.submissionId);
      if (!authorization) {
        throw new Error('Idempotent booking record disappeared during authorization lookup.');
      }
      this.authorizer.authorizeSubmissionRead(identity, authorization);
    }
    return result;
  }
}
