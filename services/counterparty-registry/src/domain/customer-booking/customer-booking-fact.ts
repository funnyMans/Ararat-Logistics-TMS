export const customerBookingStatuses = ['PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED'] as const;

export type CustomerBookingStatus = (typeof customerBookingStatuses)[number];

export function isCustomerBookingStatus(value: string): value is CustomerBookingStatus {
  return customerBookingStatuses.some((status) => status === value);
}
