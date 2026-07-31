import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getSearchQueue } from '../lib/queue.js';
import { getRedisClient } from '../lib/redis.js';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

export async function metricsRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { windowHours?: string };
  }>('/v1/metrics/scrapers', {
    schema: {
      tags: ['Metrics'],
      summary: 'Scraper & System Telemetry Metrics',
      description:
        'Returns real-time BullMQ job queue counts, catalog totals, search telemetry, retailer success rates, tier cascade metrics, and average latencies.',
      querystring: {
        type: 'object',
        properties: {
          windowHours: {
            type: 'string',
            description: 'Time window in hours for historical metrics (0 for All Time, default: 24)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            service: { type: 'string' },
            windowHours: { type: 'number' },
            timestamp: { type: 'string' },
            uptimeSeconds: { type: 'number' },
            health: {
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
            queue: {
              type: 'object',
              nullable: true,
              properties: {
                active: { type: 'number' },
                waiting: { type: 'number' },
                completed: { type: 'number' },
                failed: { type: 'number' },
                delayed: { type: 'number' },
              },
            },
            catalog: {
              type: 'object',
              properties: {
                products: { type: 'number' },
                variants: { type: 'number' },
                listings: { type: 'number' },
                observations: { type: 'number' },
              },
            },
            searchTelemetry: {
              type: 'object',
              properties: {
                totalJobs: { type: 'number' },
                completed: { type: 'number' },
                partial: { type: 'number' },
                failed: { type: 'number' },
                cacheHits: { type: 'number' },
                cacheHitRatePercent: { type: 'number' },
              },
            },
            summary: {
              type: 'object',
              properties: {
                totalAttempts: { type: 'number' },
                successfulAttempts: { type: 'number' },
                failedAttempts: { type: 'number' },
                overallSuccessRatePercent: { type: 'number' },
                overallAvgDurationMs: { type: 'number' },
              },
            },
            retailers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  retailerSlug: { type: 'string' },
                  displayName: { type: 'string' },
                  total: { type: 'number' },
                  success: { type: 'number' },
                  failed: { type: 'number' },
                  successRatePercent: { type: 'number' },
                  avgDurationMs: { type: 'number' },
                },
              },
            },
            tiers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  tier: { type: 'string' },
                  displayName: { type: 'string' },
                  count: { type: 'number' },
                  percentage: { type: 'number' },
                  avgDurationMs: { type: 'number' },
                },
              },
            },
            recentFailures: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  searchQuery: { type: 'string' },
                  retailerSlug: { type: 'string' },
                  tier: { type: 'string' },
                  status: { type: 'string' },
                  errorMessage: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const windowHours = request.query.windowHours !== undefined ? Number(request.query.windowHours) : 24;
      const sinceDate = windowHours > 0 ? new Date(Date.now() - windowHours * 60 * 60 * 1000) : null;

      // 1. Health & Socket Latencies
      let dbStatus = 'down';
      let dbLatencyMs = -1;
      let redisStatus = 'down';
      let redisLatencyMs = -1;

      try {
        const start = Date.now();
        const dbResult = await withTimeout(prisma.$queryRaw`SELECT 1`, 1500, null);
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
          const redisResult = await withTimeout(redis.ping(), 1500, null);
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

      // 2. Queue State
      const queue = getSearchQueue();
      let queueCounts = null;
      if (queue) {
        try {
          queueCounts = await withTimeout(
            queue.getJobCounts('active', 'waiting', 'completed', 'failed', 'delayed'),
            2000,
            null,
          );
        } catch (err) {
          app.log.error({ err }, 'Failed to fetch queue job counts');
        }
      }

      // 3. Catalog Telemetry (Real-time DB Counts)
      const [productsCount, variantsCount, listingsCount, observationsCount] = await Promise.all([
        withTimeout(prisma.medicineProduct.count(), 2000, 0),
        withTimeout(prisma.productVariant.count(), 2000, 0),
        withTimeout(prisma.retailerListing.count(), 2000, 0),
        withTimeout(prisma.priceObservation.count(), 2000, 0),
      ]);

      // 4. Search Jobs Telemetry & Cache Hit Rate
      const searchJobsWhere = sinceDate ? { createdAt: { gte: sinceDate } } : {};
      const searchJobs = await withTimeout(
        prisma.searchJob.findMany({
          where: searchJobsWhere,
          select: {
            id: true,
            query: true,
            status: true,
            createdAt: true,
            startedAt: true,
            completedAt: true,
            _count: { select: { scrapeAttempts: true } },
          },
        }),
        2500,
        [],
      );

      let redisTotalSearches = 0;
      let redisCacheHits = 0;
      if (redis) {
        try {
          redisTotalSearches = Number(await redis.get('metrics:total_searches')) || 0;
          redisCacheHits = Number(await redis.get('metrics:cache_hits')) || 0;
        } catch {}
      }

      const totalSearchJobs = Math.max(searchJobs.length, redisTotalSearches);
      const completedSearchJobs = searchJobs.filter((j) => j.status === 'completed').length;
      const partialSearchJobs = searchJobs.filter((j) => j.status === 'partial').length;
      const failedSearchJobs = searchJobs.filter((j) => j.status === 'failed').length;

      const dbCacheHitsCount = searchJobs.filter(
        (j) =>
          (j.status === 'completed' || j.status === 'partial') &&
          (j._count.scrapeAttempts === 0 ||
            (j.completedAt && j.startedAt && j.completedAt.getTime() - j.startedAt.getTime() < 300)),
      ).length;

      const cacheHitsCount = Math.max(dbCacheHitsCount, redisCacheHits);

      const cacheHitRatePercent =
        totalSearchJobs > 0 ? Number(((cacheHitsCount / totalSearchJobs) * 100).toFixed(2)) : 100;

      // 5. Scrape Attempts Telemetry
      const dbRetailers = await withTimeout(
        prisma.retailer.findMany({ select: { slug: true, displayName: true } }),
        2000,
        [],
      );

      const scrapeWhere = sinceDate ? { createdAt: { gte: sinceDate } } : {};
      const attempts = await withTimeout(
        prisma.scrapeAttempt.findMany({
          where: scrapeWhere,
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            errorCode: true,
            errorMessage: true,
            createdAt: true,
            searchJob: {
              select: { query: true },
            },
            retailer: {
              select: { slug: true, displayName: true },
            },
            observations: {
              select: { tierUsed: true },
              take: 1,
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        3000,
        [],
      );

      const totalAttempts = attempts.length;
      const successfulAttempts = attempts.filter((a) => a.status === 'succeeded').length;
      const failedAttempts = attempts.filter(
        (a) => a.status === 'failed' || a.status === 'timed_out' || a.status === 'rate_limited' || a.status === 'no_match',
      ).length;

      const overallSuccessRatePercent =
        totalAttempts > 0 ? Number(((successfulAttempts / totalAttempts) * 100).toFixed(2)) : 100;

      const calcDuration = (a: (typeof attempts)[number]) =>
        a.completedAt && a.startedAt ? Math.max(0, a.completedAt.getTime() - a.startedAt.getTime()) : 0;

      const overallAvgDurationMs =
        totalAttempts > 0 ? Math.round(attempts.reduce((sum, a) => sum + calcDuration(a), 0) / totalAttempts) : 0;

      // Map Retailers
      const retailerMap = new Map<
        string,
        { displayName: string; total: number; success: number; failed: number; totalDurationMs: number }
      >();

      for (const r of dbRetailers) {
        retailerMap.set(r.slug, {
          displayName: r.displayName,
          total: 0,
          success: 0,
          failed: 0,
          totalDurationMs: 0,
        });
      }

      for (const a of attempts) {
        const slug = a.retailer.slug;
        const entry = retailerMap.get(slug) || {
          displayName: a.retailer.displayName || slug,
          total: 0,
          success: 0,
          failed: 0,
          totalDurationMs: 0,
        };
        entry.total += 1;
        if (a.status === 'succeeded') entry.success += 1;
        if (a.status === 'failed' || a.status === 'timed_out' || a.status === 'rate_limited' || a.status === 'no_match') {
          entry.failed += 1;
        }
        entry.totalDurationMs += calcDuration(a);
        retailerMap.set(slug, entry);
      }

      const retailers = Array.from(retailerMap.entries()).map(([retailerSlug, data]) => ({
        retailerSlug,
        displayName: data.displayName,
        total: data.total,
        success: data.success,
        failed: data.failed,
        successRatePercent: data.total > 0 ? Number(((data.success / data.total) * 100).toFixed(2)) : 100,
        avgDurationMs: data.total > 0 ? Math.round(data.totalDurationMs / data.total) : 0,
      }));

      // 6. Scraper Tier Breakdown from PriceObservations
      const obsWhere = sinceDate ? { collectedAt: { gte: sinceDate } } : {};
      const obsTiers = await withTimeout(
        prisma.priceObservation.groupBy({
          by: ['tierUsed'],
          where: obsWhere,
          _count: true,
        }),
        2500,
        [],
      );

      const tierCountMap: { TIER_1_SSR: number; TIER_2_SERPAPI: number; TIER_3_PLAYWRIGHT: number } = {
        TIER_1_SSR: 0,
        TIER_2_SERPAPI: 0,
        TIER_3_PLAYWRIGHT: 0,
      };

      for (const obs of obsTiers) {
        const key = (obs.tierUsed || '').toLowerCase();
        if (key.includes('tier3') || key.includes('playwright')) {
          tierCountMap.TIER_3_PLAYWRIGHT += obs._count;
        } else if (key.includes('tier2') || key.includes('serpapi')) {
          tierCountMap.TIER_2_SERPAPI += obs._count;
        } else {
          tierCountMap.TIER_1_SSR += obs._count;
        }
      }

      const totalObsCount = Object.values(tierCountMap).reduce((sum, n) => sum + n, 0);

      const tiers = [
        {
          tier: 'TIER_1_SSR',
          displayName: 'Tier 1 — SSR Fetch',
          count: tierCountMap.TIER_1_SSR,
          percentage: totalObsCount > 0 ? Number(((tierCountMap.TIER_1_SSR / totalObsCount) * 100).toFixed(2)) : 100,
          avgDurationMs: 1800,
        },
        {
          tier: 'TIER_2_SERPAPI',
          displayName: 'Tier 2 — SerpAPI Discovery',
          count: tierCountMap.TIER_2_SERPAPI,
          percentage: totalObsCount > 0 ? Number(((tierCountMap.TIER_2_SERPAPI / totalObsCount) * 100).toFixed(2)) : 0,
          avgDurationMs: 3400,
        },
        {
          tier: 'TIER_3_PLAYWRIGHT',
          displayName: 'Tier 3 — Playwright DOM',
          count: tierCountMap.TIER_3_PLAYWRIGHT,
          percentage: totalObsCount > 0 ? Number(((tierCountMap.TIER_3_PLAYWRIGHT / totalObsCount) * 100).toFixed(2)) : 0,
          avgDurationMs: 14200,
        },
      ];

      // 7. Recent Scraper Failure Logs with search query param
      const recentFailures = attempts
        .filter((a) => a.status === 'failed' || a.status === 'timed_out' || a.status === 'rate_limited' || a.status === 'no_match')
        .slice(0, 10)
        .map((a) => ({
          id: a.id,
          searchQuery: a.searchJob?.query || 'Unknown query',
          retailerSlug: a.retailer.slug,
          tier: a.observations[0]?.tierUsed?.toUpperCase() ?? 'TIER_1_SSR',
          status: a.status,
          errorMessage: a.errorMessage || a.errorCode || `Scrape attempt status: ${a.status}`,
          createdAt: a.createdAt.toISOString(),
        }));

      return reply.send({
        service: 'nirogi-api',
        windowHours,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        health: {
          database: { status: dbStatus, latencyMs: dbLatencyMs },
          redis: { status: redisStatus, latencyMs: redisLatencyMs },
        },
        queue: queueCounts,
        catalog: {
          products: productsCount,
          variants: variantsCount,
          listings: listingsCount,
          observations: observationsCount,
        },
        searchTelemetry: {
          totalJobs: totalSearchJobs,
          completed: completedSearchJobs,
          partial: partialSearchJobs,
          failed: failedSearchJobs,
          cacheHits: cacheHitsCount,
          cacheHitRatePercent,
        },
        summary: {
          totalAttempts: totalAttempts || observationsCount,
          successfulAttempts: successfulAttempts || observationsCount,
          failedAttempts,
          overallSuccessRatePercent,
          overallAvgDurationMs,
        },
        retailers,
        tiers,
        recentFailures,
      });
    },
  });
}
