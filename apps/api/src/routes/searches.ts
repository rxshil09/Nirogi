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

    // Check for an existing completed job with usable offers
    const existing = await prisma.searchJob.findFirst({
      where: { cacheKey, status: { in: ['completed', 'partial'] } },
      orderBy: { completedAt: 'desc' },
    });

    if (existing?.completedAt) {
      const ageMs = now.getTime() - existing.completedAt.getTime();

      if (ageMs <= FRESH_WINDOW_MS) {
        // Fresh — return cached job status immediately
        return reply.send({
          searchJobId: existing.id,
          status: existing.status,
          pollAfterMs: 0,
        });
      }

      if (ageMs <= STALE_LIMIT_MS) {
        // Stale but usable — return cached job status immediately and enqueue background refresh
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

    const redis = getRedisClient();
    if (redis) {
      const lockKey = `lock:search:${cacheKey}`;
      const lockAcquired = await redis.set(lockKey, 'locked', 'PX', 5000, 'NX');

      if (!lockAcquired) {
        // Wait for the other process to create the job
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
  app.get('/v1/searches/:searchJobId', async (request, reply) => {
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
  // Get all attempts for this job — including failed/no_match ones for placeholder cards
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
    // Calculate per-retailer fetch time from DB timestamps
    const fetchTimeMs =
      attempt.startedAt && attempt.completedAt
        ? attempt.completedAt.getTime() - attempt.startedAt.getTime()
        : null;

    // If this attempt has a successful observation, return the full offer
    if (attempt.status === 'succeeded' && attempt.observations.length > 0) {
      const obs = attempt.observations[0]!;

      // If the matched variant is marked as rejected (completely different brand), return a not_found placeholder
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

    // For no_match, failed, or timed_out — return a placeholder card
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
        tierUsed: 'tier1_ssr',
      }];
    }

    // Still running or queued — return 'searching' placeholder card
    if (['running', 'queued'].includes(attempt.status)) {
      return [{
        retailer: attempt.retailer.slug,
        sourceTitle: null,
        sourceUrl: null,
        pricePaise: null,
        mrpPaise: null,
        discountPercent: null,
        pricePerUnit: null,
        manufacturerName: null,
        availability: 'searching',
        collectedAt: (attempt.startedAt ?? new Date()).toISOString(),
        matchStatus: 'unmatched',
        fetchTimeMs: null,
      }];
    }

    return [];
  });
}

async function enqueueJob(payload: { searchJobId: string; query: string; pincode?: string; retailerSlugs?: string[] }): Promise<boolean> {
  const queue = getSearchQueue();
  if (!queue) {
    return false;
  }
  await queue.add('search', payload, { jobId: payload.searchJobId });
  return true;
}
