import type { CapacityCommitmentRepository } from '../../application/ports/capacity-commitment-ports';

export type CapacityHoldExpiryErrorHandler = (error: unknown) => void;

export class CapacityHoldExpiryWorker {
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> | undefined;

  constructor(
    private readonly repository: CapacityCommitmentRepository,
    private readonly onError: CapacityHoldExpiryErrorHandler,
    private readonly pollingIntervalMs = 1_000
  ) {
    if (!Number.isInteger(pollingIntervalMs) || pollingIntervalMs < 100) {
      throw new RangeError(
        'Capacity hold-expiry polling interval must be at least 100 milliseconds.'
      );
    }
  }

  start(): void {
    if (this.timer) {
      throw new Error('Capacity hold-expiry worker is already running.');
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
    this.inFlight = this.repository
      .expireDueHolds()
      .then(() => undefined)
      .catch((error: unknown) => {
        this.onError(error);
      })
      .finally(() => {
        this.inFlight = undefined;
      });
  }
}
