import { z } from 'zod';
export declare const RetailerSlugSchema: z.ZodEnum<["one-mg", "netmeds", "pharmeasy"]>;
export type RetailerSlug = z.infer<typeof RetailerSlugSchema>;
export declare const MEDICINE_QUERY_REGEX: RegExp;
export declare const SearchRequestSchema: z.ZodObject<{
    query: z.ZodString;
    pincode: z.ZodOptional<z.ZodString>;
    retailerSlugs: z.ZodOptional<z.ZodArray<z.ZodEnum<["one-mg", "netmeds", "pharmeasy"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    query: string;
    pincode?: string | undefined;
    retailerSlugs?: ("one-mg" | "netmeds" | "pharmeasy")[] | undefined;
}, {
    query: string;
    pincode?: string | undefined;
    retailerSlugs?: ("one-mg" | "netmeds" | "pharmeasy")[] | undefined;
}>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export declare const AvailabilitySchema: z.ZodEnum<["in_stock", "out_of_stock", "not_for_sale", "unknown", "not_found", "searching"]>;
export type Availability = z.infer<typeof AvailabilitySchema>;
export declare const MatchStatusSchema: z.ZodEnum<["exact", "candidate", "unmatched"]>;
export type MatchStatus = z.infer<typeof MatchStatusSchema>;
export declare const TierUsedSchema: z.ZodEnum<["tier1_ssr", "tier2_serp", "tier3_playwright"]>;
export type TierUsed = z.infer<typeof TierUsedSchema>;
export declare const SourceOfferSchema: z.ZodObject<{
    retailer: z.ZodEnum<["one-mg", "netmeds", "pharmeasy"]>;
    sourceTitle: z.ZodNullable<z.ZodString>;
    sourceUrl: z.ZodNullable<z.ZodString>;
    pricePaise: z.ZodNullable<z.ZodNumber>;
    mrpPaise: z.ZodNullable<z.ZodNumber>;
    discountPercent: z.ZodNullable<z.ZodNumber>;
    pricePerUnit: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    manufacturerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    availability: z.ZodDefault<z.ZodEnum<["in_stock", "out_of_stock", "not_for_sale", "unknown", "not_found", "searching"]>>;
    collectedAt: z.ZodString;
    matchStatus: z.ZodDefault<z.ZodEnum<["exact", "candidate", "unmatched"]>>;
    /** Time in milliseconds it took to fetch this result from the retailer */
    fetchTimeMs: z.ZodNullable<z.ZodNumber>;
    /** Which collection tier produced this offer (tier1_ssr, tier2_serp, or tier3_playwright) */
    tierUsed: z.ZodOptional<z.ZodEnum<["tier1_ssr", "tier2_serp", "tier3_playwright"]>>;
}, "strip", z.ZodTypeAny, {
    retailer: "one-mg" | "netmeds" | "pharmeasy";
    sourceTitle: string | null;
    matchStatus: "exact" | "candidate" | "unmatched";
    pricePaise: number | null;
    mrpPaise: number | null;
    availability: "unknown" | "in_stock" | "out_of_stock" | "not_for_sale" | "not_found" | "searching";
    collectedAt: string;
    sourceUrl: string | null;
    discountPercent: number | null;
    fetchTimeMs: number | null;
    manufacturerName?: string | null | undefined;
    tierUsed?: "tier1_ssr" | "tier2_serp" | "tier3_playwright" | undefined;
    pricePerUnit?: string | null | undefined;
}, {
    retailer: "one-mg" | "netmeds" | "pharmeasy";
    sourceTitle: string | null;
    pricePaise: number | null;
    mrpPaise: number | null;
    collectedAt: string;
    sourceUrl: string | null;
    discountPercent: number | null;
    fetchTimeMs: number | null;
    manufacturerName?: string | null | undefined;
    matchStatus?: "exact" | "candidate" | "unmatched" | undefined;
    availability?: "unknown" | "in_stock" | "out_of_stock" | "not_for_sale" | "not_found" | "searching" | undefined;
    tierUsed?: "tier1_ssr" | "tier2_serp" | "tier3_playwright" | undefined;
    pricePerUnit?: string | null | undefined;
}>;
export type SourceOffer = z.infer<typeof SourceOfferSchema>;
export declare const SearchJobStatusSchema: z.ZodEnum<["queued", "running", "partial", "completed", "failed", "cancelled"]>;
export type SearchJobStatus = z.infer<typeof SearchJobStatusSchema>;
export declare const SearchJobResponseSchema: z.ZodObject<{
    searchJobId: z.ZodString;
    status: z.ZodEnum<["queued", "running", "partial", "completed", "failed", "cancelled"]>;
    pollAfterMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "queued" | "running" | "partial" | "completed" | "failed" | "cancelled";
    searchJobId: string;
    pollAfterMs: number;
}, {
    status: "queued" | "running" | "partial" | "completed" | "failed" | "cancelled";
    searchJobId: string;
    pollAfterMs: number;
}>;
export type SearchJobResponse = z.infer<typeof SearchJobResponseSchema>;
export declare const SearchResultResponseSchema: z.ZodObject<{
    searchJobId: z.ZodString;
    productVariantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodEnum<["queued", "running", "partial", "completed", "failed", "cancelled"]>;
    cacheStatus: z.ZodEnum<["fresh", "stale", "miss"]>;
    results: z.ZodArray<z.ZodObject<{
        retailer: z.ZodEnum<["one-mg", "netmeds", "pharmeasy"]>;
        sourceTitle: z.ZodNullable<z.ZodString>;
        sourceUrl: z.ZodNullable<z.ZodString>;
        pricePaise: z.ZodNullable<z.ZodNumber>;
        mrpPaise: z.ZodNullable<z.ZodNumber>;
        discountPercent: z.ZodNullable<z.ZodNumber>;
        pricePerUnit: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        manufacturerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        availability: z.ZodDefault<z.ZodEnum<["in_stock", "out_of_stock", "not_for_sale", "unknown", "not_found", "searching"]>>;
        collectedAt: z.ZodString;
        matchStatus: z.ZodDefault<z.ZodEnum<["exact", "candidate", "unmatched"]>>;
        /** Time in milliseconds it took to fetch this result from the retailer */
        fetchTimeMs: z.ZodNullable<z.ZodNumber>;
        /** Which collection tier produced this offer (tier1_ssr, tier2_serp, or tier3_playwright) */
        tierUsed: z.ZodOptional<z.ZodEnum<["tier1_ssr", "tier2_serp", "tier3_playwright"]>>;
    }, "strip", z.ZodTypeAny, {
        retailer: "one-mg" | "netmeds" | "pharmeasy";
        sourceTitle: string | null;
        matchStatus: "exact" | "candidate" | "unmatched";
        pricePaise: number | null;
        mrpPaise: number | null;
        availability: "unknown" | "in_stock" | "out_of_stock" | "not_for_sale" | "not_found" | "searching";
        collectedAt: string;
        sourceUrl: string | null;
        discountPercent: number | null;
        fetchTimeMs: number | null;
        manufacturerName?: string | null | undefined;
        tierUsed?: "tier1_ssr" | "tier2_serp" | "tier3_playwright" | undefined;
        pricePerUnit?: string | null | undefined;
    }, {
        retailer: "one-mg" | "netmeds" | "pharmeasy";
        sourceTitle: string | null;
        pricePaise: number | null;
        mrpPaise: number | null;
        collectedAt: string;
        sourceUrl: string | null;
        discountPercent: number | null;
        fetchTimeMs: number | null;
        manufacturerName?: string | null | undefined;
        matchStatus?: "exact" | "candidate" | "unmatched" | undefined;
        availability?: "unknown" | "in_stock" | "out_of_stock" | "not_for_sale" | "not_found" | "searching" | undefined;
        tierUsed?: "tier1_ssr" | "tier2_serp" | "tier3_playwright" | undefined;
        pricePerUnit?: string | null | undefined;
    }>, "many">;
    lastCheckedAt: z.ZodNullable<z.ZodString>;
    sourceErrors: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    status: "queued" | "running" | "partial" | "completed" | "failed" | "cancelled";
    searchJobId: string;
    cacheStatus: "fresh" | "stale" | "miss";
    results: {
        retailer: "one-mg" | "netmeds" | "pharmeasy";
        sourceTitle: string | null;
        matchStatus: "exact" | "candidate" | "unmatched";
        pricePaise: number | null;
        mrpPaise: number | null;
        availability: "unknown" | "in_stock" | "out_of_stock" | "not_for_sale" | "not_found" | "searching";
        collectedAt: string;
        sourceUrl: string | null;
        discountPercent: number | null;
        fetchTimeMs: number | null;
        manufacturerName?: string | null | undefined;
        tierUsed?: "tier1_ssr" | "tier2_serp" | "tier3_playwright" | undefined;
        pricePerUnit?: string | null | undefined;
    }[];
    lastCheckedAt: string | null;
    sourceErrors: string[];
    productVariantId?: string | null | undefined;
}, {
    status: "queued" | "running" | "partial" | "completed" | "failed" | "cancelled";
    searchJobId: string;
    cacheStatus: "fresh" | "stale" | "miss";
    results: {
        retailer: "one-mg" | "netmeds" | "pharmeasy";
        sourceTitle: string | null;
        pricePaise: number | null;
        mrpPaise: number | null;
        collectedAt: string;
        sourceUrl: string | null;
        discountPercent: number | null;
        fetchTimeMs: number | null;
        manufacturerName?: string | null | undefined;
        matchStatus?: "exact" | "candidate" | "unmatched" | undefined;
        availability?: "unknown" | "in_stock" | "out_of_stock" | "not_for_sale" | "not_found" | "searching" | undefined;
        tierUsed?: "tier1_ssr" | "tier2_serp" | "tier3_playwright" | undefined;
        pricePerUnit?: string | null | undefined;
    }[];
    lastCheckedAt: string | null;
    sourceErrors: string[];
    productVariantId?: string | null | undefined;
}>;
export type SearchResultResponse = z.infer<typeof SearchResultResponseSchema>;
