import { Queue, Worker, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';

export const redis = new IORedis(process.env.REDIS_URL as string, {
  maxRetriesPerRequest: null, // BullMQ requires this to be null
  enableReadyCheck: false,
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
  connectTimeout: 5000,
  commandTimeout: 3000,
  lazyConnect: false, // Force immediate connection like in test
});

export const SAMPLE_SCORE_QUEUE = 'sample-score';

export const sampleScoreQueue = new Queue(SAMPLE_SCORE_QUEUE, { connection: redis });
// QueueScheduler is deprecated in newer BullMQ versions - scheduling is now built into Queue

export function addSampleScoreJob(payload: { sampleId: string }, opts?: JobsOptions) {
  return sampleScoreQueue.add('score-sample', payload, {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: 50,
    ...opts,
  });
}

export function createWorker(handler: (data: { sampleId: string }) => Promise<void>) {
  return new Worker(
    SAMPLE_SCORE_QUEUE,
    async (job) => {
      await handler(job.data as { sampleId: string });
    },
    { connection: redis }
  );
}

