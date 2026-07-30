import { Queue } from 'bullmq';
import { env } from '@nirogi/config';

export interface SearchJobPayload {
  searchJobId: string;
  query: string;
  pincode?: string;
  retailerSlugs?: string[];
}

let searchQueue: Queue<SearchJobPayload> | null = null;

/**
 * Returns the BullMQ queue if REDIS_URL is configured, otherwise null.
 * The API degrades gracefully — job submission is skipped when Redis is absent.
 */
export const getSearchQueue = (): Queue<SearchJobPayload> | null => {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!searchQueue) {
    const url = new URL(env.REDIS_URL);
    searchQueue = new Queue<SearchJobPayload>('search-jobs', {
      connection: {
        host: url.hostname,
        port: Number(url.port) || 6379,
        password: url.password || undefined,
        tls: url.protocol === 'rediss:' ? {} : undefined,
      },
      defaultJobOptions: {
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
      },
    });
  }

  return searchQueue;
};
