import type { IdentityTokenClaims } from '@app/identity-token';
import { LoadAccessAuthorizer } from '../authorization/load-access-authorizer';
import type {
  BookingSubmissionReadResult,
  LoadReadRepository,
  LoadReadResult,
} from '../ports/load-read-repository';

export class LoadResourceNotFoundError extends Error {
  constructor() {
    super('Resource not found');
    this.name = 'LoadResourceNotFoundError';
  }
}

export class LoadReads {
  constructor(
    private readonly repository: LoadReadRepository,
    private readonly authorizer = new LoadAccessAuthorizer()
  ) {}

  async getLoad(identity: IdentityTokenClaims, loadId: string): Promise<unknown> {
    const result = await this.repository.findLoad(loadId);
    this.requireLoad(result);
    this.authorizer.authorizeLoadRead(identity, result.authorization);
    return result.representation;
  }

  async getRevision(
    identity: IdentityTokenClaims,
    loadId: string,
    revisionId: string
  ): Promise<unknown> {
    const result = await this.repository.findRevision(loadId, revisionId);
    this.requireLoad(result);
    this.authorizer.authorizeRevisionRead(identity, result.authorization);
    return result.representation;
  }

  async getBookingSubmission(
    identity: IdentityTokenClaims,
    submissionId: string
  ): Promise<unknown> {
    const result = await this.repository.findBookingSubmission(submissionId);
    this.requireSubmission(result);
    this.authorizer.authorizeSubmissionRead(identity, result.authorization);
    return result.representation;
  }

  private requireLoad(result: LoadReadResult | null): asserts result is LoadReadResult {
    if (!result) {
      throw new LoadResourceNotFoundError();
    }
  }

  private requireSubmission(
    result: BookingSubmissionReadResult | null
  ): asserts result is BookingSubmissionReadResult {
    if (!result) {
      throw new LoadResourceNotFoundError();
    }
  }
}
