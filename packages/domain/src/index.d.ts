/**
 * Parse a rupee string like "₹123.45" or "Rs. 123.45" into integer paise.
 * Returns null if the value is absent or unparseable.
 */
export declare const parseRupeesToPaise: (value: string | null | undefined) => number | null;
/**
 * Parse a percentage string like "20%" or "20 % off" into a number.
 * Returns null if the value is absent or unparseable.
 */
export declare const parsePercentage: (value: string | null | undefined) => number | null;
/**
 * Format integer paise as a human-readable INR string.
 */
export declare const formatPaise: (paise: number | null) => string;
/**
 * Normalise a free-text medicine query for deduplication and cache-key usage.
 * Lowercases, collapses whitespace, and strips punctuation.
 */
export declare const normaliseQuery: (query: string) => string;
/**
 * Build a stable cache key for a search request.
 * The key is independent of source set — it represents the user's intent.
 */
export declare const buildCacheKey: (query: string, pincode?: string) => string;
/**
 * Normalise manufacturer name for stable entity matching across scrapers.
 * Maps common manufacturer variations (e.g. "Cipla Ltd", "Cipla Limited") to a canonical key.
 */
export declare const normaliseManufacturerName: (name: string | null | undefined) => string;
/**
 * Build a deterministic variant key to deduplicate product variants.
 * All inputs are normalized and lowercased before joining.
 */
export declare const buildNormalisedVariantKey: (opts: {
    productId: string;
    strengthValue?: string | null;
    strengthUnit?: string | null;
    dosageForm?: string | null;
    packQuantity?: number | null;
    packUnit?: string | null;
    manufacturerName?: string | null;
}) => string;
/**
 * Strip UTM and other tracking parameters from a URL to produce a canonical URL.
 */
export declare const canonicalUrl: (raw: string) => string;
/**
 * Strip dosage form and packaging descriptors from a search query to isolate brand + strength.
 * E.g. "Gelusil MPS syrup" -> "Gelusil MPS", "Cefonac O syrup" -> "Cefonac O", "Volini gel" -> "Volini"
 */
export declare const stripFormDescriptors: (query: string) => string;
/**
 * Calculate per-unit price based on dosage form, total price in paise, and pack quantity.
 * Returns a formatted string (e.g. "₹12.34 / unit") or null if inputs are invalid.
 */
export declare const calculatePerUnitPrice: (pricePaise: number | null | undefined, packQuantity: number | null | undefined, dosageForm: string | null | undefined) => string | null;
export { parseMedicineTitle, type ParsedMedicine } from './parser.js';
export { extractEmbeddedJSON } from './extract-embedded-json.js';
