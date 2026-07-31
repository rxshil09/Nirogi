import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { getRedisClient } from './lib/redis.js';
import { catalogRoutes } from './routes/catalog.js';
import { healthRoutes } from './routes/health.js';
import { metricsRoutes } from './routes/metrics.js';
import { priceHistoryRoutes } from './routes/price-history.js';
import { productRoutes } from './routes/products.js';
import { searchRoutes } from './routes/searches.js';

export const buildApp = async () => {
  const app = Fastify({ logger: true });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  const corsOrigin =
    env.WEB_ORIGIN === '*'
      ? '*'
      : env.WEB_ORIGIN.includes(',')
        ? env.WEB_ORIGIN.split(',').map((s) => s.trim())
        : env.WEB_ORIGIN;

  await app.register(cors, {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'Accept', 'Origin'],
    exposedHeaders: ['x-request-id'],
    credentials: env.WEB_ORIGIN !== '*',
    maxAge: 86400,
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Nirogi Medicine Search & Price Comparison API',
        description: 'Real-time medicine price comparison engine across Indian online pharmacies.',
        version: '0.1.0',
      },
      servers: [
        {
          url: 'https://nirogi-api-production.up.railway.app',
          description: 'Production Server',
        },
        {
          url: 'http://localhost:4000',
          description: 'Local Development Server',
        },
      ],
      tags: [
        { name: 'Health', description: 'System health & probe endpoints' },
        { name: 'Searches', description: 'Real-time medicine search & background job execution' },
        { name: 'Products', description: 'Medicine details, listings, & variant data' },
        { name: 'Catalog', description: 'Medicine catalog suggestions & auto-complete' },
        { name: 'Metrics', description: 'Scraper success rates & queue performance metrics' },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  const redis = getRedisClient();
  if (redis) {
    await app.register(rateLimit, {
      max: 30,
      timeWindow: '1 minute',
      redis,
      keyGenerator: (request) => request.ip,
    });
  } else {
    await app.register(rateLimit, {
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

  await app.register(healthRoutes);
  await app.register(metricsRoutes);
  await app.register(catalogRoutes);
  await app.register(priceHistoryRoutes);
  await app.register(productRoutes);
  await app.register(searchRoutes);

  return app;
};
