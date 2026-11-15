import type {
  CapacityCommitmentRepository,
  CapacityOutboxPublisher,
} from '../../application/ports/capacity-commitment-ports';

export type CapacityOutboxWorkerErrorHandler = (error: unknown) => void;

export class CapacityOutboxWorker {
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> | undefined;

  constructor(
    private readonly repository: CapacityCommitmentRepository,
    private readonly publisher: CapacityOutboxPublisher,
    private readonly onError: CapacityOutboxWorkerErrorHandler,
    private readonly pollingIntervalMs = 1_000
  ) {
    if (!Number.isInteger(pollingIntervalMs) || pollingIntervalMs < 100) {
      throw new RangeError('Capacity outbox polling interval must be at least 100 milliseconds.');
    }
  }

  start(): void {
    if (this.timer) {
      throw new Error('Capacity outbox worker is already running.');
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
    this.inFlight = this.publishPending()
      .catch((error: unknown) => {
        this.onError(error);
      })
      .finally(() => {
        this.inFlight = undefined;
      });
  }

  private async publishPending(): Promise<void> {
    let hasMore = await this.repository.publishNextOutboxMessage(this.publisher);
    while (hasMore) {
      hasMore = await this.repository.publishNextOutboxMessage(this.publisher);
    }
  }
}
