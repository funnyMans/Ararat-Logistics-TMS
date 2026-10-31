import { describe, expect, it, vi } from 'vitest';
import type {
  LoadBookingOutboxRepository,
  LoadOutboxPublisher,
} from '../../src/application/ports/load-booking-ports';
import { LoadBookingOutboxWorker } from '../../src/infrastructure/messaging/load-booking-outbox-worker';

describe('LoadBookingOutboxWorker', () => {
  it('drains pending messages and waits for in-flight work during shutdown', async () => {
    let remaining = 2;
    const repository: LoadBookingOutboxRepository = {
      publishNextOutboxMessage: vi.fn(async (_publisher: LoadOutboxPublisher) => remaining-- > 0),
    };
    const publisher: LoadOutboxPublisher = { publish: vi.fn(async () => undefined) };
    const onError = vi.fn();
    const worker = new LoadBookingOutboxWorker(repository, publisher, onError);

    worker.start();
    await vi.waitFor(() => {
      expect(repository.publishNextOutboxMessage).toHaveBeenCalledTimes(3);
    });
    await worker.stop();

    expect(onError).not.toHaveBeenCalled();
  });

  it('reports publisher failures without marking the worker successful', async () => {
    const failure = new Error('broker unavailable');
    const repository: LoadBookingOutboxRepository = {
      publishNextOutboxMessage: vi.fn(async () => {
        throw failure;
      }),
    };
    const onError = vi.fn();
    const worker = new LoadBookingOutboxWorker(repository, { publish: vi.fn() }, onError);

    worker.start();
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(failure);
    });
    await worker.stop();
  });
});
