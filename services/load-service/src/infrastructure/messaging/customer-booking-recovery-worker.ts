import type { PostgresCustomerBookingProjectionRepository } from '../persistence/postgres-customer-booking-projection-repository';
import type { CustomerBookingSnapshotPublisher } from '../persistence/postgres-customer-booking-projection-repository';

export type LoadCustomerBookingWorkerErrorHandler = (error: unknown) => void;

export class CustomerBookingRecoveryWorker {
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> | undefined;

  constructor(
    private readonly repository: PostgresCustomerBookingProjectionRepository,
    private readonly publisher: CustomerBookingSnapshotPublisher,
    private readonly onError: LoadCustomerBookingWorkerErrorHandler,
    private readonly pollingIntervalMs = 1_000
  ) {
    if (!Number.isInteger(pollingIntervalMs) || pollingIntervalMs < 100) {
      throw new RangeError('Customer booking recovery polling interval must be at least 100ms.');
    }
  }

  start(): void {
    if (this.timer) {
      throw new Error('Customer booking recovery worker is already running.');
    }
    this.timer = setInterval(() => {
      this.runOnce();
    }, this.pollingIntervalMs);
    this.runOnce();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.inFlight;
  }

  private runOnce(): void {
    if (this.inFlight) {
      return;
    }
    this.inFlight = this.reconcileAndPublish()
      .catch((error: unknown) => {
        this.onError(error);
      })
      .finally(() => {
        this.inFlight = undefined;
      });
  }

  private async reconcileAndPublish(): Promise<void> {
    await this.repository.expireWatermark();
    let hasMore = await this.repository.publishNextSnapshotRequest(this.publisher);
    while (hasMore) {
      hasMore = await this.repository.publishNextSnapshotRequest(this.publisher);
    }
  }
}
