import { Client, Connection, type WorkflowHandle } from '@temporalio/client';
import { NativeConnection, Worker } from '@temporalio/worker';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import {
  getConformanceProgress,
  persistenceConformanceWorkflow,
} from './temporal/conformance-workflow';

const temporalIntegration = process.env.TEMPORAL_INTEGRATION === '1' ? describe : describe.skip;
const composeArgs = ['compose', '-f', 'infra/docker-compose.dev.yml'];
const taskQueue = 'foundation-temporal-conformance';
const connectionTimeoutMs = 45_000;
const connectionAttemptTimeoutMs = 2_000;

function runCompose(...args: string[]): string {
  return execFileSync('docker', [...composeArgs, ...args], {
    encoding: 'utf8',
    timeout: 10_000,
  }).trim();
}

function temporalAddress(): string {
  const binding = runCompose('port', 'temporal', '7233');
  const hostPort = binding.split(':').at(-1);
  if (!hostPort) {
    throw new Error(`Could not determine Temporal's published host port from "${binding}".`);
  }

  return `127.0.0.1:${hostPort}`;
}

async function connectToTemporal(address: string): Promise<Connection> {
  const deadline = Date.now() + connectionTimeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      return await Connection.connect({
        address,
        connectTimeout: connectionAttemptTimeoutMs,
      });
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }

  throw new Error('Temporal did not become available.', { cause: lastError });
}

async function waitForProgress(
  handle: WorkflowHandle<typeof persistenceConformanceWorkflow>,
  expectedState: 'waiting'
): Promise<void> {
  const deadline = Date.now() + connectionTimeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const progress = await handle.query(getConformanceProgress);
      if (progress.state === expectedState) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(100);
  }

  throw new Error(`Workflow did not reach "${expectedState}" before timeout.`, {
    cause: lastError,
  });
}

async function startWorker(
  identity: string
): Promise<{ worker: Worker; connection: NativeConnection; run: Promise<void> }> {
  const connection = await NativeConnection.connect({ address: temporalAddress() });
  try {
    const worker = await Worker.create({
      connection,
      taskQueue,
      workflowsPath: require.resolve('./temporal/conformance-workflow.ts'),
      activities: {
        identifyWorker: async () => identity,
      },
    });

    return { worker, connection, run: worker.run() };
  } catch (error) {
    await connection.close();
    throw error;
  }
}

async function stopWorker(activeWorker: Awaited<ReturnType<typeof startWorker>>): Promise<void> {
  activeWorker.worker.shutdown();
  await activeWorker.run;
  await activeWorker.connection.close();
}

temporalIntegration('Temporal workflow persistence conformance', () => {
  it('resumes a persisted workflow on a replacement worker and returns its resulting state', async () => {
    const clientConnection = await connectToTemporal(temporalAddress());
    const client = new Client({ connection: clientConnection });
    const workflowId = `foundation-temporal-persistence-conformance-${randomUUID()}`;
    let firstWorker: Awaited<ReturnType<typeof startWorker>> | undefined;
    let replacementWorker: Awaited<ReturnType<typeof startWorker>> | undefined;
    let workflowCompleted = false;
    let handle: WorkflowHandle<typeof persistenceConformanceWorkflow> | undefined;

    try {
      firstWorker = await startWorker('first-worker');
      handle = await client.workflow.start(persistenceConformanceWorkflow, {
        workflowId,
        taskQueue,
      });

      await waitForProgress(handle, 'waiting');
      await stopWorker(firstWorker);
      firstWorker = undefined;

      replacementWorker = await startWorker('replacement-worker');
      const result = await handle.result();
      workflowCompleted = true;

      expect(result).toEqual({
        state: 'completed',
        steps: ['started', 'waiting', 'completed'],
        completedBy: 'replacement-worker',
      });
    } finally {
      if (firstWorker) {
        await stopWorker(firstWorker).catch(() => undefined);
      }
      if (replacementWorker) {
        await stopWorker(replacementWorker).catch(() => undefined);
      }
      if (!workflowCompleted && handle) {
        await handle.terminate('Cleaning up a failed conformance test run').catch(() => undefined);
      }
      await clientConnection.close();
    }
  }, 90_000);
});
