import type { CustomerStatus } from './customer-booking-projection';

export type CustomerBookingFactResult =
  | {
      result: 'FOUND';
      status: CustomerStatus;
      legalName: string;
      ownerRevision: number;
      registrySequence: number;
    }
  | {
      result: 'NOT_FOUND';
      registrySequence: number;
    };
