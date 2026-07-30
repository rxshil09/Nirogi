import { z } from 'zod';
export const RetailerSlugSchema = z.enum(['one-mg', 'netmeds', 'pharmeasy']);
export const MEDICINE_QUERY_REGEX = /^[a-zA-Z0-9\s\-\.\/%()]+$/;
export const SearchRequestSchema = z.object({
    query: z
        .string()
        .trim()
        .min(2, 'Search query must be at least 2 characters.')
        .max(200, 'Search query must be under 200 characters.')
        .regex(MEDICINE_QUERY_REGEX, 'Query contains invalid characters. Use letters, numbers, spaces, and standard medicine symbols (- . / % ()).'),
    pincode: z.string().trim().regex(/^\d{6}$/).optional(),
    retailerSlugs: z.array(RetailerSlugSchema).min(1).optional(),
});
export const AvailabilitySchema = z.enum(['in_stock', 'out_of_stock', 'not_for_sale', 'unknown', 'not_found', 'searching']);
export const MatchStatusSchema = z.enum(['exact', 'candidate', 'unmatched']);
export const TierUsedSchema = z.enum(['tier1_ssr', 'tier2_serp', 'tier3_playwright']);
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
export const SearchJobStatusSchema = z.enum([
    'queued',
    'running',
    'partial',
    'completed',
    'failed',
    'cancelled',
]);
export const SearchJobResponseSchema = z.object({
    searchJobId: z.string().uuid(),
    status: SearchJobStatusSchema,
    pollAfterMs: z.number().int().nonnegative(),
});
export const SearchResultResponseSchema = z.object({
    searchJobId: z.string().uuid(),
    productVariantId: z.string().uuid().nullable().optional(),
    status: SearchJobStatusSchema,
    cacheStatus: z.enum(['fresh', 'stale', 'miss']),
    results: z.array(SourceOfferSchema),
    lastCheckedAt: z.string().datetime().nullable(),
    sourceErrors: z.array(z.string()),
});
//# sourceMappingURL=index.js.map