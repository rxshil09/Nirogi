import { z } from 'zod';

export const RetailerSlugSchema = z.enum(['one-mg', 'netmeds', 'pharmeasy']);
export type RetailerSlug = z.infer<typeof RetailerSlugSchema>;

export const SearchRequestSchema = z.object({
  query: z.string().trim().min(2).max(200),
  pincode: z.string().trim().regex(/^\d{6}$/).optional(),
  retailerSlugs: z.array(RetailerSlugSchema).min(1).optional(),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const AvailabilitySchema = z.enum(['in_stock', 'out_of_stock', 'not_for_sale', 'unknown', 'not_found', 'searching']);
export type Availability = z.infer<typeof AvailabilitySchema>;

export const MatchStatusSchema = z.enum(['exact', 'candidate', 'unmatched']);
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

export const TierUsedSchema = z.enum(['tier1_ssr', 'tier2_serp', 'tier3_playwright']);
export type TierUsed = z.infer<typeof TierUsedSchema>;

export const SourceOfferSchema = z.object({
  retailer: RetailerSlugSchema,
  sourceTitle: z.string().trim().min(1).nullable(),
  sourceUrl: z.string().url().nullable(),
  pricePaise: z.number().int().nonnegative().nullable(),
  mrpPaise: z.number().int().nonnegative().nullable(),
  discountPercent: z.number().min(0).max(100).nullable(),
  pricePerUnit: z.string().nullable().optional(),
  manufacturerName: z.string().nullable().optional(),
  availability: AvailabilitySchema.default('unknown'),
  collectedAt: z.string().datetime(),
  matchStatus: MatchStatusSchema.default('candidate'),
  /** Time in milliseconds it took to fetch this result from the retailer */
  fetchTimeMs: z.number().int().nonnegative().nullable(),
  /** Which collection tier produced this offer (tier1_ssr, tier2_serp, or tier3_playwright) */
  tierUsed: TierUsedSchema.optional(),
});
export type SourceOffer = z.infer<typeof SourceOfferSchema>;

export const SearchJobStatusSchema = z.enum([
  'queued',
  'running',
  'partial',
  'completed',
  'failed',
  'cancelled',
]);
export type SearchJobStatus = z.infer<typeof SearchJobStatusSchema>;

export const SearchJobResponseSchema = z.object({
  searchJobId: z.string().uuid(),
  status: SearchJobStatusSchema,
  pollAfterMs: z.number().int().nonnegative(),
});
export type SearchJobResponse = z.infer<typeof SearchJobResponseSchema>;

export const SearchResultResponseSchema = z.object({
  searchJobId: z.string().uuid(),
  productVariantId: z.string().uuid().nullable().optional(),
  status: SearchJobStatusSchema,
  cacheStatus: z.enum(['fresh', 'stale', 'miss']),
  results: z.array(SourceOfferSchema),
  lastCheckedAt: z.string().datetime().nullable(),
  sourceErrors: z.array(z.string()),
});
export type SearchResultResponse = z.infer<typeof SearchResultResponseSchema>;
