import type { IdentityTokenClaims } from '@app/identity-token';
import type { BookingSubmissionAccess } from '../../domain/authorization/load-access-policy';
import type { PickupCountyGeography } from '../../domain/authorization/load-operating-area';
import type { CustomerBookingFactResult } from '../../domain/customer-booking/customer-booking-fact-result';

export type { CustomerBookingFactResult } from '../../domain/customer-booking/customer-booking-fact-result';

export interface LoadPickupGeographyResolver {
  resolveFirstPickupGeographies(rows: unknown[]): Promise<Array<PickupCountyGeography | null>>;
}

export interface LoadBookingSubmissionRepository {
  findSubmission(submissionId: string): Promise<BookingSubmissionAccess | null>;
  findIdempotentSubmission(
    identity: IdentityTokenClaims,
    request: LoadBookingSubmissionRequest
  ): Promise<{
    result: LoadBookingSubmissionResult;
    authorization: BookingSubmissionAccess;
  } | null>;
  createSubmission(
    identity: IdentityTokenClaims,
    request: LoadBookingSubmissionRequest,
    areaIds: string[],
    areaMappingRevisions: string[],
    customerFacts: Record<string, CustomerBookingFactResult>
  ): Promise<LoadBookingSubmissionResult>;
}

export interface LoadBookingOutboxRepository {
  publishNextOutboxMessage(publisher: LoadOutboxPublisher): Promise<boolean>;
}

export interface LoadOutboxPublisher {
  publish(routingKey: string, messageId: string, payload: unknown): Promise<void>;
}

export type CustomerBookingFactLookup =
  { available: true; fact: CustomerBookingFactResult } | { available: false };

export interface LoadCustomerBookingFactReader {
  getUsableOrRequestReconciliation(customerId: string): Promise<CustomerBookingFactLookup>;
}

export type LoadBookingSubmissionRequest = {
  idempotencyKey: string;
  rows: unknown[];
  correctionOfSubmissionId?: string | null;
};

export type LoadBookingSubmissionResult = {
  submissionId: string;
  replayed: boolean;
  representation: unknown;
};
