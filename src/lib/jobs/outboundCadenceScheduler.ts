import { Queue, Worker, Job } from 'bullmq';
import { env } from '@/lib/env';

const connection = {
  host: env.REDIS_HOST || '127.0.0.1',
  port: Number(env.REDIS_PORT || 6379),
  password: env.REDIS_PASSWORD || undefined,
};

export interface CadenceJobData {
  enrollmentId: string;
}

export const cadenceQueue = new Queue<CadenceJobData>('outbound-cadence', {
  connection,
});

export const cadenceWorker = new Worker<CadenceJobData>(
  'outbound-cadence',
  async (job: Job<CadenceJobData>) => {
    console.log('[CadenceWorker] processing enrollment', job.data.enrollmentId);
  },
  {
    connection,
  }
);

cadenceWorker.on('completed', (job) => {
  console.log('[CadenceWorker] completed job', job.id);
});

cadenceWorker.on('failed', (job, err) => {
  console.warn('[CadenceWorker] failed job', job?.id, err);
});
