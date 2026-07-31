import { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { getRedisClient } from '../lib/redis.js';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

export async function healthRoutes(app: FastifyInstance) {
  const livenessHandler = async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'nirogi-api',
  });

  app.get('/v1/health/liveness', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness probe',
      description: 'Quick check to confirm the API server process is alive.',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            service: { type: 'string' },
          },
        },
      },
    },
    handler: livenessHandler,
  });

  app.get('/v1/live', livenessHandler);

  const readinessHandler = async (_request: unknown, reply: any) => {
    let dbStatus = 'down';
    let dbLatencyMs = -1;
    let redisStatus = 'down';
    let redisLatencyMs = -1;

    try {
      const start = Date.now();
      const dbResult = await withTimeout(prisma.$queryRaw`SELECT 1`, 2000, null);
      if (dbResult !== null) {
        dbLatencyMs = Date.now() - start;
        dbStatus = 'up';
      }
    } catch (err) {
      app.log.error({ err }, 'Health check PostgreSQL ping failed');
    }

    const redis = getRedisClient();
    if (redis) {
      try {
        const start = Date.now();
        const redisResult = await withTimeout(redis.ping(), 2000, null);
        if (redisResult === 'PONG') {
          redisLatencyMs = Date.now() - start;
          redisStatus = 'up';
        }
      } catch (err) {
        app.log.error({ err }, 'Health check Redis ping failed');
      }
    } else {
      redisStatus = 'not_configured';
    }

    const isHealthy = dbStatus === 'up' && (redisStatus === 'up' || redisStatus === 'not_configured');
    const statusCode = isHealthy ? 200 : 503;

    return reply.status(statusCode).send({
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'nirogi-api',
      checks: {
        database: { status: dbStatus, latencyMs: dbLatencyMs },
        redis: { status: redisStatus, latencyMs: redisLatencyMs },
      },
    });
  };

  app.get('/v1/health/readiness', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness probe',
      description: 'Probes active connections to PostgreSQL and Redis.',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            service: { type: 'string' },
            checks: {
              type: 'object',
              properties: {
                database: {
                  type: 'object',
                  properties: { status: { type: 'string' }, latencyMs: { type: 'number' } },
                },
                redis: {
                  type: 'object',
                  properties: { status: { type: 'string' }, latencyMs: { type: 'number' } },
                },
              },
            },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            service: { type: 'string' },
            checks: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    handler: readinessHandler,
  });

  app.get('/v1/ready', readinessHandler);

  app.get('/v1/health', {
    schema: {
      tags: ['Health'],
      summary: 'Overall health status',
      description: 'Provides a consolidated summary of system health and connectivity.',
      response: {
        200: {
          type: 'object',
          properties: {
            service: { type: 'string' },
            status: { type: 'string' },
            version: { type: 'string' },
            databaseConfigured: { type: 'boolean' },
            redisConfigured: { type: 'boolean' },
            checks: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    handler: async (_request: unknown, reply: any) => {
      let dbStatus = 'down';
      let dbLatencyMs = -1;
      let redisStatus = 'down';
      let redisLatencyMs = -1;

      try {
        const start = Date.now();
        const dbResult = await withTimeout(prisma.$queryRaw`SELECT 1`, 2000, null);
        if (dbResult !== null) {
          dbLatencyMs = Date.now() - start;
          dbStatus = 'up';
        }
      } catch {
        dbStatus = 'down';
      }

      const redis = getRedisClient();
      if (redis) {
        try {
          const start = Date.now();
          const redisResult = await withTimeout(redis.ping(), 2000, null);
          if (redisResult === 'PONG') {
            redisLatencyMs = Date.now() - start;
            redisStatus = 'up';
          }
        } catch {
          redisStatus = 'down';
        }
      } else {
        redisStatus = 'not_configured';
      }

      const isHealthy = dbStatus === 'up' && (redisStatus === 'up' || redisStatus === 'not_configured');

      return reply.status(isHealthy ? 200 : 503).send({
        service: 'nirogi-api',
        status: isHealthy ? 'ok' : 'degraded',
        version: '0.1.0',
        databaseConfigured: Boolean(env.DATABASE_URL),
        redisConfigured: Boolean(env.REDIS_URL),
        checks: {
          database: { status: dbStatus, latencyMs: dbLatencyMs },
          redis: { status: redisStatus, latencyMs: redisLatencyMs },
        },
      });
    },
  });
}
