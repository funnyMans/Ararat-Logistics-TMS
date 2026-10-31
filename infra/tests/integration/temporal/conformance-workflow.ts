import { defineQuery, proxyActivities, setHandler, sleep } from '@temporalio/workflow';

export interface ConformanceProgress {
  state: 'started' | 'waiting' | 'completed';
  steps: string[];
}

export interface ConformanceResult extends ConformanceProgress {
  completedBy: string;
}

export const getConformanceProgress = defineQuery<ConformanceProgress>('getConformanceProgress');

const { identifyWorker } = proxyActivities<{
  identifyWorker(): Promise<string>;
}>({
  startToCloseTimeout: '10 seconds',
});

export async function persistenceConformanceWorkflow(): Promise<ConformanceResult> {
  const progress: ConformanceProgress = { state: 'started', steps: ['started'] };
  setHandler(getConformanceProgress, () => progress);

  progress.state = 'waiting';
  progress.steps.push('waiting');
  await sleep('8 seconds');

  const completedBy = await identifyWorker();
  progress.state = 'completed';
  progress.steps.push('completed');

  return { ...progress, completedBy };
}
