import type {
  BookingSubmissionAccess,
  LoadResourceAccess,
} from '../../domain/authorization/load-access-policy';

export type LoadReadResult = {
  authorization: LoadResourceAccess;
  representation: unknown;
};

export type BookingSubmissionReadResult = {
  authorization: BookingSubmissionAccess;
  representation: unknown;
};

export interface LoadReadRepository {
  findLoad(loadId: string): Promise<LoadReadResult | null>;
  findRevision(loadId: string, revisionId: string): Promise<LoadReadResult | null>;
  findBookingSubmission(submissionId: string): Promise<BookingSubmissionReadResult | null>;
}
