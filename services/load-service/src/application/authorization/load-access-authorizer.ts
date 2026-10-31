import type { IdentityTokenClaims } from '@app/identity-token';
import {
  loadAccessPolicy,
  type BookingArea,
  type BookingSubmissionAccess,
  type LoadResourceAccess,
} from '../../domain/authorization/load-access-policy';

export class LoadAccessAuthorizer {
  authorizeBooking(identity: IdentityTokenClaims, rows: BookingArea[]): void {
    loadAccessPolicy.authorizeBooking(identity, rows);
  }

  authorizeLoadRead(identity: IdentityTokenClaims, load: LoadResourceAccess): void {
    loadAccessPolicy.authorizeLoadRead(identity, load);
  }

  authorizeRevisionRead(identity: IdentityTokenClaims, load: LoadResourceAccess): void {
    loadAccessPolicy.authorizeRevisionRead(identity, load);
  }

  authorizeSubmissionRead(
    identity: IdentityTokenClaims,
    submission: BookingSubmissionAccess
  ): void {
    loadAccessPolicy.authorizeSubmissionRead(identity, submission);
  }

  authorizeCorrection(identity: IdentityTokenClaims, submission: BookingSubmissionAccess): void {
    loadAccessPolicy.authorizeCorrection(identity, submission);
  }
}
