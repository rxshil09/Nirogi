import type { FastifyPluginAsync } from 'fastify';
import { SearchRequestSchema, SearchResultResponseSchema } from '@nirogi/contracts';
import { buildCacheKey, calculatePerUnitPrice } from '@nirogi/domain';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getSearchQueue } from '../lib/queue.js';
import { getRedisClient } from '../lib/redis.js';

const SearchJobParamsSchema = z.object({
  searchJobId: z.string().uuid(),
});

// Offers collected within this window are considered "fresh" — return immediately.
const FRESH_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours
// Offers older than this are too stale to serve even with a warning.
const STALE_LIMIT_MS = 48 * 60 * 60 * 1000; // 48 hours

export const searchRoutes: FastifyPluginAsync = async (app) => {
  // POST /v1/searches — submit a search, return cached result or enqueue a job
  app.post('/v1/searches', {
    schema: {
      tags: ['Searches'],
      summary: 'Initiate or fetch medicine price search',
      description: 'Accepts a medicine query and pincode. Returns cached results immediately if available, or enqueues a background scraping job.',
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', examples: ['Dolo 650'] },
          pincode: { type: 'string', examples: ['110001'] },
          retailerSlugs: { type: 'array', items: { type: 'string' }, examples: [['1mg', 'pharmeasy', 'netmeds']] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            searchJobId: { type: 'string' },
            status: { type: 'string' },
            pollAfterMs: { type: 'number' },
          },
        },
        202: {
          type: 'object',
          properties: {
            searchJobId: { type: 'string' },
            status: { type: 'string' },
            pollAfterMs: { type: 'number' },
          },
        },
      },
    },
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const body = SearchRequestSchema.parse(request.body);
    const cacheKey = buildCacheKey(body.query, body.pincode);
    const now = new Date();

    const redis = getRedisClient();
    if (redis) {
      void redis.incr('metrics:total_searches').catch(() => null);
    }

    // Check for an existing completed job with usable offers
    const existing = await prisma.searchJob.findFirst({
      where: { cacheKey, status: { in: ['completed', 'partial'] }, scrapeAttempts: { some: {} } },
      orderBy: { completedAt: 'desc' },
    });

    if (existing?.completedAt) {
      const ageMs = now.getTime() - existing.completedAt.getTime();

      if (ageMs <= FRESH_WINDOW_MS) {
        // Fresh — increment cache hit counter and return existing job ID immediately
        if (redis) {
          void redis.incr('metrics:cache_hits').catch(() => null);
        }
        return reply.send({
          searchJobId: existing.id,
          status: existing.status,
          pollAfterMs: 0,
        });
      }

      if (ageMs <= STALE_LIMIT_MS) {
        // Stale but usable — increment cache hit counter, return existing job, and trigger background refresh
        if (redis) {
          void redis.incr('metrics:cache_hits').catch(() => null);
        }
        void enqueueJob({ searchJobId: existing.id, ...body });
        return reply.send({
          searchJobId: existing.id,
          status: existing.status,
          pollAfterMs: 0,
        });
      }
    }

    // Check if there is an active job (queued or running)
    const active = await prisma.searchJob.findFirst({
      where: { cacheKey, status: { in: ['queued', 'running'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (active) {
      return reply.send({
        searchJobId: active.id,
        status: active.status,
        pollAfterMs: 1500,
      });
    }

    if (redis) {
      const lockKey = `lock:search:${cacheKey}`;
      const lockAcquired = await redis.set(lockKey, 'locked', 'PX', 5000, 'NX');

      if (!lockAcquired) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const activeRetry = await prisma.searchJob.findFirst({
          where: { cacheKey, status: { in: ['queued', 'running', 'completed', 'partial'] } },
          orderBy: { createdAt: 'desc' },
        });
        if (activeRetry) {
          return reply.send({
            searchJobId: activeRetry.id,
            status: activeRetry.status,
            pollAfterMs: ['completed', 'partial'].includes(activeRetry.status) ? 0 : 1500,
          });
        }
      }

      try {
        const newJob = await prisma.searchJob.create({
          data: {
            query: body.query,
            pincode: body.pincode,
            cacheKey,
            status: 'queued',
          },
        });
        const queued = await enqueueJob({ searchJobId: newJob.id, ...body });
        return reply.status(202).send({
          searchJobId: newJob.id,
          status: 'queued',
          pollAfterMs: queued ? 1500 : 0,
        });
      } finally {
        await redis.del(lockKey);
      }
    }

    // Cold (fallback when Redis is not available) — create a new job and enqueue it
    const newJob = await prisma.searchJob.create({
      data: {
        query: body.query,
        pincode: body.pincode,
        cacheKey,
        status: 'queued',
      },
    });

    const queued = await enqueueJob({ searchJobId: newJob.id, ...body });

    return reply.status(202).send({
      searchJobId: newJob.id,
      status: 'queued',
      pollAfterMs: queued ? 1500 : 0,
    });
  });

  // GET /v1/searches/:searchJobId — poll for job status and results
  app.get('/v1/searches/:searchJobId', {
    schema: {
      tags: ['Searches'],
      summary: 'Poll search job status & price comparison results',
      description: 'Returns real-time search job status, offers collected across retailers, lowest price, and availability.',
      params: {
        type: 'object',
        properties: {
          searchJobId: { type: 'string', format: 'uuid', description: 'Search job UUID' },
        },
      },
    },
  }, async (request, reply) => {
    const { searchJobId } = SearchJobParamsSchema.parse(request.params);

    const job = await prisma.searchJob.findUnique({
      where: { id: searchJobId },
      include: {
        scrapeAttempts: { select: { status: true, errorCode: true, errorMessage: true } },
      },
    });

    if (!job) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Search job not found.' });
    }

    const offers = await buildOffersForJob(searchJobId);
    const sourceErrors = job.scrapeAttempts
      .filter((a) => a.status === 'failed' || a.status === 'rate_limited' || a.status === 'timed_out')
      .map((a) => a.errorMessage ?? a.errorCode ?? 'Unknown error');

    return reply.send(
      SearchResultResponseSchema.parse({
        searchJobId: job.id,
        productVariantId: job.productVariantId,
        status: job.status,
        cacheStatus: offers.length > 0 ? 'fresh' : 'miss',
        results: offers,
        lastCheckedAt: job.completedAt?.toISOString() ?? null,
        sourceErrors,
      }),
    );
  });
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildOffersForJob(searchJobId: string) {
  const attempts = await prisma.scrapeAttempt.findMany({
    where: { searchJobId },
    include: {
      retailer: true,
      observations: {
        orderBy: { collectedAt: 'desc' },
        take: 1,
        include: {
          retailerListing: {
            include: {
              productVariant: true,
            },
          },
        },
      },
    },
  });

  type OfferRow = {
    retailer: string;
    sourceTitle: string | null;
    sourceUrl: string | null;
    pricePaise: number | null;
    mrpPaise: number | null;
    discountPercent: number | null;
    pricePerUnit: string | null;
    manufacturerName: string | null;
    availability: string;
    collectedAt: string;
    matchStatus: string;
    fetchTimeMs: number | null;
    tierUsed?: 'tier1_ssr' | 'tier2_serp' | 'tier3_playwright';
  };

  return attempts.flatMap((attempt): OfferRow[] => {
    const fetchTimeMs =
      attempt.startedAt && attempt.completedAt
        ? attempt.completedAt.getTime() - attempt.startedAt.getTime()
        : null;

    if (attempt.status === 'succeeded' && attempt.observations.length > 0) {
      const obs = attempt.observations[0]!;

      if (obs.retailerListing.matchStatus === 'rejected') {
        return [{
          retailer: attempt.retailer.slug,
          sourceTitle: null,
          sourceUrl: null,
          pricePaise: null,
          mrpPaise: null,
          discountPercent: null,
          pricePerUnit: null,
          manufacturerName: null,
          availability: 'not_found',
          collectedAt: obs.collectedAt.toISOString(),
          matchStatus: 'unmatched',
          fetchTimeMs,
          tierUsed: ((obs as any).tierUsed as any) ?? 'tier3_playwright',
        }];
      }

      const variant = obs.retailerListing.productVariant;
      return [{
        retailer: attempt.retailer.slug,
        sourceTitle: obs.retailerListing.sourceTitle,
        sourceUrl: obs.retailerListing.canonicalUrl,
        pricePaise: obs.pricePaise,
        mrpPaise: obs.mrpPaise,
        discountPercent:
          obs.pricePaise != null && obs.mrpPaise != null && obs.mrpPaise > 0
            ? Math.round(((obs.mrpPaise - obs.pricePaise) / obs.mrpPaise) * 100)
            : null,
        pricePerUnit: calculatePerUnitPrice(obs.pricePaise, variant?.packQuantity, variant?.dosageForm),
        manufacturerName: variant?.manufacturerName ?? null,
        availability: obs.availability,
        collectedAt: obs.collectedAt.toISOString(),
        matchStatus: obs.retailerListing.matchStatus === 'exact' ? 'exact' : 'candidate',
        fetchTimeMs,
        tierUsed: ((obs as any).tierUsed as any) ?? 'tier3_playwright',
      }];
    }

    if (['no_match', 'failed', 'timed_out', 'rate_limited'].includes(attempt.status)) {
      return [{
        retailer: attempt.retailer.slug,
        sourceTitle: null,
        sourceUrl: null,
        pricePaise: null,
        mrpPaise: null,
        discountPercent: null,
        pricePerUnit: null,
        manufacturerName: null,
        availability: 'not_found',
        collectedAt: (attempt.completedAt ?? attempt.startedAt ?? new Date()).toISOString(),
        matchStatus: 'unmatched',
        fetchTimeMs,
        tierUsed: 'tier3_playwright',
      }];
    }

    return [];
  });
}

async function enqueueJob(input: { searchJobId: string; query: string; pincode?: string; retailerSlugs?: string[] }): Promise<boolean> {
  const queue = getSearchQueue();
  if (!queue) return false;
  await queue.add('search', input);
  return true;
}
