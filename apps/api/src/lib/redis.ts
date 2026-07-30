import { Redis } from 'ioredis';
import { env } from '@nirogi/config';

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const getRedisClient = (): Redis | null => {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  return globalForRedis.redis;
};
