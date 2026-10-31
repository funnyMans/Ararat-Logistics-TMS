import type { IdentityTokenClaims } from '@app/identity-token';
import { LoadAccessAuthorizer } from '../authorization/load-access-authorizer';
import type {
  CustomerBookingFactResult,
  LoadCustomerBookingFactReader,
  LoadBookingSubmissionRepository,
  LoadPickupAreaResolver,
} from '../ports/load-booking-ports';
import type { LoadBookingSubmissionRequest } from '../ports/load-booking-ports';

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
    super('A booking submission requires rows and an Idempotency-Key.');
    this.name = 'InvalidBookingSubmissionError';
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
    private readonly areaResolver: LoadPickupAreaResolver,
    private readonly repository: LoadBookingSubmissionRepository,
    private readonly customerFacts: LoadCustomerBookingFactReader,
    private readonly authorizer = new LoadAccessAuthorizer()
  ) {}

  async execute(identity: IdentityTokenClaims, request: LoadBookingSubmissionRequest) {
    if (request.rows.length === 0 || request.idempotencyKey.length === 0) {
      throw new InvalidBookingSubmissionError();
    }

    const resolvedAreas = await this.areaResolver.resolveFirstPickupAreas(request.rows);
    if (!Array.isArray(resolvedAreas) || resolvedAreas.length !== request.rows.length) {
      throw new Error('The pickup area resolver returned an incomplete result.');
    }

    const areaIds: string[] = [];
    for (const areaId of resolvedAreas) {
      if (typeof areaId !== 'string') {
        throw new InvalidBookingAreaError();
      }
      areaIds.push(areaId);
    }

    for (const [index, row] of request.rows.entries()) {
      if (isRecord(row) && row.areaId !== undefined && row.areaId !== areaIds[index]) {
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
        return UUID_V7_PATTERN.test(row.customerId) ? [row.customerId] : [];
      })
    )) {
      const lookup = await this.customerFacts.getUsableOrRequestReconciliation(customerId);
      if (!lookup.available) {
        throw new CustomerStatusUnavailableError();
      }
      customerFactResults[customerId] = lookup.fact;
    }

    return this.repository.createSubmission(identity, request, areaIds, customerFactResults);
  }
}
