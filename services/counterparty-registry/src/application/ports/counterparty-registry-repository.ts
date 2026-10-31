import type { CustomerBookingStatus } from '../../domain/customer-booking/customer-booking-fact';

export type RecordCustomerBookingFactCommand = {
  customerId: string;
  counterpartyId: string;
  status: CustomerBookingStatus;
  legalName: string;
  actorPrincipalId: string;
  reason: string;
  correlationId?: string;
};

export type CustomerBookingFactChanged = {
  messageId: string;
  messageType: 'counterparty.customer.booking-fact.changed';
  schemaVersion: '1.0.0';
  sourceService: 'counterparty-registry';
  targetService: 'load';
  occurredAt: string;
  correlationId: string;
  ownerRevision: number;
  registrySequence: number;
  payload: {
    customerId: string;
    status: CustomerBookingStatus;
    legalName: string;
  };
};

export type CustomerBookingSnapshotRequest = {
  messageId: string;
  messageType: 'counterparty.customer.booking-fact.snapshot.get';
  schemaVersion: '1.0.0';
  sourceService: 'load';
  targetService: 'counterparty-registry';
  issuedAt: string;
  correlationId: string;
  causationId?: string;
  payload: {
    customerId: string;
    lastAppliedOwnerRevision: number;
    minimumRegistrySequence: number;
    observedOwnerRevision?: number;
    reason: 'MISSING' | 'REVISION_GAP' | 'REGISTRY_SEQUENCE_GAP' | 'STALE' | 'STREAM_GAP';
  };
};

export type CustomerBookingSnapshotResult = {
  messageId: string;
  messageType: 'counterparty.customer.booking-fact.snapshot.result';
  schemaVersion: '1.0.0';
  sourceService: 'counterparty-registry';
  targetService: 'load';
  occurredAt: string;
  correlationId: string;
  causationId: string;
  ownerRevision?: number;
  payload:
    | {
        customerId: string;
        result: 'FOUND';
        status: CustomerBookingStatus;
        legalName: string;
        ownerRevision: number;
        registrySequence: number;
      }
    | {
        customerId: string;
        result: 'NOT_FOUND';
        registrySequence: number;
      };
};

export interface CounterpartyRegistryRepository {
  recordCustomerBookingFact(
    command: RecordCustomerBookingFactCommand
  ): Promise<CustomerBookingFactChanged | null>;
  answerCustomerBookingFactSnapshot(
    request: CustomerBookingSnapshotRequest
  ): Promise<'queued' | 'duplicate' | 'quarantined'>;
  enqueueCompletenessWatermarkIfDue(now?: Date): Promise<boolean>;
  publishNextOutboxMessage(publisher: DurableCustomerMessagePublisher): Promise<boolean>;
}

export interface DurableCustomerMessagePublisher {
  publish(routingKey: string, messageId: string, payload: unknown): Promise<void>;
}
