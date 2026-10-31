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
    areaIds: string[]
  ): Promise<LoadBookingSubmissionResult>;
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
