import { Redis } from 'ioredis';
import { env } from '@nirogi/config';

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const getRedisClient = (): Redis | null => {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!globalForRedis.redis) {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    client.on('error', () => {
      // Suppress unhandled redis connection errors during local runs/tests
    });
    globalForRedis.redis = client;
  }

  return globalForRedis.redis;
};
