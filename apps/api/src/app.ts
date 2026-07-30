import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { getRedisClient } from './lib/redis.js';
import { catalogRoutes } from './routes/catalog.js';
import { priceHistoryRoutes } from './routes/price-history.js';
import { productRoutes } from './routes/products.js';
import { searchRoutes } from './routes/searches.js';

export const buildApp = () => {
  const app = Fastify({ logger: true });

  app.register(helmet, {
    contentSecurityPolicy: false, // Allows API response rendering across origins
  });

  app.register(cors, {
    origin: env.WEB_ORIGIN,
    methods: ['GET', 'POST'],
  });

  const redis = getRedisClient();
  if (redis) {
    app.register(rateLimit, {
      max: 30,
      timeWindow: '1 minute',
      redis,
      keyGenerator: (request) => request.ip,
    });
  } else {
    app.register(rateLimit, {
      max: 30,
      timeWindow: '1 minute',
      keyGenerator: (request) => request.ip,
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'The request is invalid.',
        issues: error.flatten(),
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
  });

  app.get('/v1/health', async () => ({
    service: 'nirogi-api',
    status: 'ok',
    phase: 1,
    databaseConfigured: Boolean(env.DATABASE_URL),
    redisConfigured: Boolean(env.REDIS_URL),
  }));

  app.register(catalogRoutes);
  app.register(priceHistoryRoutes);
  app.register(productRoutes);
  app.register(searchRoutes);
  return app;
};
