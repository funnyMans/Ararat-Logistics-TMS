import type { CapacityCommitmentCommand } from '../../interfaces/messaging/capacity-commitment-messages';

export type CapacityCommitmentOutcome = Record<string, unknown> & {
  messageId: string;
  messageType: string;
};

export interface CapacityOutboxPublisher {
  publish(routingKey: string, messageId: string, payload: unknown): Promise<void>;
}

export interface CapacityCommitmentRepository {
  execute(command: CapacityCommitmentCommand): Promise<CapacityCommitmentOutcome>;
  expireDueHolds(): Promise<number>;
  publishNextOutboxMessage(publisher: CapacityOutboxPublisher): Promise<boolean>;
}
