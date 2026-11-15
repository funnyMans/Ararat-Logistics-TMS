import type {
  LoadBookingOutboxRepository,
  LoadOutboxPublisher,
} from '../../application/ports/load-booking-ports';

export type LoadOutboxWorkerErrorHandler = (error: unknown) => void;

export class LoadBookingOutboxWorker {
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> | undefined;

  constructor(
    private readonly repository: LoadBookingOutboxRepository,
    private readonly publisher: LoadOutboxPublisher,
    private readonly onError: LoadOutboxWorkerErrorHandler,
    private readonly pollingIntervalMs = 1_000
  ) {
    if (!Number.isInteger(pollingIntervalMs) || pollingIntervalMs < 100) {
      throw new RangeError('Load outbox polling interval must be at least 100 milliseconds.');
    }
  }

  start(): void {
    if (this.timer) {
      throw new Error('Load booking outbox worker is already running.');
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
