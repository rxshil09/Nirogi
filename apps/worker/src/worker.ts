import 'dotenv/config';
import { Worker } from 'bullmq';
import { env } from '@nirogi/config';
import { runPipeline } from './services/pipeline.js';
import type { SearchJobPayload } from './types.js';

if (!env.REDIS_URL) {
  process.stderr.write(
    '[worker] REDIS_URL is not set. The BullMQ worker requires Redis to receive jobs.\n' +
    '[worker] Use "npm run scrape -- --source one-mg --query <name>" for a manual single-source run.\n',
  );
  process.exit(1);
}

const redisUrl = new URL(env.REDIS_URL);

const worker = new Worker<SearchJobPayload>(
  'search-jobs',
  async (job) => {
    process.stdout.write(`[worker] Processing job ${job.id} — query: "${job.data.query}"\n`);

    await runPipeline({
      searchJobId: job.data.searchJobId,
      query: job.data.query,
      pincode: job.data.pincode,
      retailerSlugs: job.data.retailerSlugs,
    });

    process.stdout.write(`[worker] Completed job ${job.id}\n`);
  },
  {
    connection: {
      host: redisUrl.hostname,
      port: Number(redisUrl.port) || 6379,
      username: redisUrl.username || undefined,
      password: redisUrl.password || undefined,
      tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
    },
    concurrency: 5,
  },
);

worker.on('failed', (job, error) => {
  process.stderr.write(`[worker] Job ${job?.id ?? '?'} failed: ${error.message}\n`);
});

worker.on('ready', () => {
  process.stdout.write('[worker] Ready — listening for search-jobs on Redis\n');
});

process.on('SIGTERM', async () => {
  process.stdout.write('[worker] SIGTERM received — closing gracefully\n');
  await worker.close();
  process.exit(0);
});
