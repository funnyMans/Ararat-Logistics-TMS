import type { IdentityTokenClaims } from '@app/identity-token';
import type { BookingSubmissionAccess } from '../../domain/authorization/load-access-policy';

export interface LoadPickupAreaResolver {
  resolveFirstPickupAreas(rows: unknown[]): Promise<Array<string | null>>;
}

export interface LoadBookingSubmissionRepository {
  findSubmission(submissionId: string): Promise<BookingSubmissionAccess | null>;
  createSubmission(
    identity: IdentityTokenClaims,
    request: LoadBookingSubmissionRequest,
    areaIds: string[],
    customerFacts: Record<string, CustomerBookingFactResult>
  ): Promise<LoadBookingSubmissionResult>;
}

export type CustomerBookingFactResult =
  | {
      result: 'FOUND';
      status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
      legalName: string;
      ownerRevision: number;
      registrySequence: number;
    }
  | {
      result: 'NOT_FOUND';
      registrySequence: number;
    };

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
