// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------
/**
 * Parse a rupee string like "₹123.45" or "Rs. 123.45" into integer paise.
 * Returns null if the value is absent or unparseable.
 */
export const parseRupeesToPaise = (value) => {
    if (!value)
        return null;
    const normalized = value.replace(/[^\d.]/g, '');
    if (!normalized)
        return null;
    const rupees = Number.parseFloat(normalized);
    return Number.isFinite(rupees) ? Math.round(rupees * 100) : null;
};
/**
 * Parse a percentage string like "20%" or "20 % off" into a number.
 * Returns null if the value is absent or unparseable.
 */
export const parsePercentage = (value) => {
    if (!value)
        return null;
    const normalized = value.replace(/[^\d.]/g, '');
    if (!normalized)
        return null;
    const pct = Number.parseFloat(normalized);
    return Number.isFinite(pct) ? pct : null;
};
/**
 * Format integer paise as a human-readable INR string.
 */
export const formatPaise = (paise) => paise === null
    ? 'Price unavailable'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(paise / 100);
// ---------------------------------------------------------------------------
// Query normalisation
// ---------------------------------------------------------------------------
/**
 * Normalise a free-text medicine query for deduplication and cache-key usage.
 * Lowercases, collapses whitespace, and strips punctuation.
 */
export const normaliseQuery = (query) => query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
/**
 * Build a stable cache key for a search request.
 * The key is independent of source set — it represents the user's intent.
 */
export const buildCacheKey = (query, pincode) => {
    const normQ = normaliseQuery(query);
    return pincode ? `q:${normQ}|pin:${pincode}` : `q:${normQ}`;
};
// ---------------------------------------------------------------------------
// Variant normalisation
// ---------------------------------------------------------------------------
/**
 * Normalise manufacturer name for stable entity matching across scrapers.
 * Maps common manufacturer variations (e.g. "Cipla Ltd", "Cipla Limited") to a canonical key.
 */
export const normaliseManufacturerName = (name) => {
    if (!name)
        return '';
    let norm = name.toLowerCase().trim();
    // Strip Mkt: or Mfg: prefix
    norm = norm.replace(/^(mkt|mfg|manufactured by|marketed by):\s*/i, '');
    // Standardize common Indian pharma brand aliases
    if (norm.includes('cipla'))
        return 'cipla';
    if (norm.includes('sun pharm') || norm.includes('sun pharma'))
        return 'sun pharma';
    if (norm.includes('dr. reddy') || norm.includes("dr reddy's") || norm.includes('dr reddy'))
        return 'dr reddys';
    if (norm.includes('torrent'))
        return 'torrent pharma';
    if (norm.includes('alkem'))
        return 'alkem';
    if (norm.includes('lupin'))
        return 'lupin';
    if (norm.includes('mankind'))
        return 'mankind';
    if (norm.includes('zydus') || norm.includes('cadila'))
        return 'zydus';
    if (norm.includes('abbott'))
        return 'abbott';
    if (norm.includes('gsk') || norm.includes('glaxosmithkline'))
        return 'gsk';
    if (norm.includes('sanofi'))
        return 'sanofi';
    if (norm.includes('pfizer'))
        return 'pfizer';
    if (norm.includes('biochem'))
        return 'biochem';
    if (norm.includes('micro lab'))
        return 'micro labs';
    if (norm.includes('intas'))
        return 'intas';
    if (norm.includes('glenmark'))
        return 'glenmark';
    if (norm.includes('ipca'))
        return 'ipca';
    if (norm.includes('apex'))
        return 'apex';
    if (norm.includes('usv'))
        return 'usv';
    if (norm.includes('alembic'))
        return 'alembic';
    if (norm.includes('aristo'))
        return 'aristo';
    if (norm.includes('macleod'))
        return 'macleods';
    if (norm.includes('hetero'))
        return 'hetero';
    if (norm.includes('jb chem') || norm.includes('j.b. chem') || norm.includes('j b chem'))
        return 'jb chemicals';
    if (norm.includes('systopic'))
        return 'systopic';
    if (norm.includes('blue cross'))
        return 'blue cross';
    // Fallback cleanup: strip corporate legal suffixes
    return norm
        .replace(/\b(ltd|limited|laboratories|laboratory|pharmaceuticals|pharmaceutical|pharma|pvt|private|inc|corp|corporation)\b/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};
/**
 * Build a deterministic variant key to deduplicate product variants.
 * All inputs are normalized and lowercased before joining.
 */
export const buildNormalisedVariantKey = (opts) => {
    const normMfr = normaliseManufacturerName(opts.manufacturerName);
    const parts = [
        opts.productId,
        (opts.strengthValue ?? '').toLowerCase().trim(),
        (opts.strengthUnit ?? '').toLowerCase().trim(),
        (opts.dosageForm ?? '').toLowerCase().trim(),
        opts.packQuantity != null ? String(opts.packQuantity) : '',
        (opts.packUnit ?? '').toLowerCase().trim(),
        normMfr,
    ];
    return parts.join('|');
};
// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------
/**
 * Strip UTM and other tracking parameters from a URL to produce a canonical URL.
 */
export const canonicalUrl = (raw) => {
    try {
        const url = new URL(raw);
        const TRACKING_PARAMS = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
            'ref', 'referrer', 'source', 'gclid', 'fbclid', 'msclkid',
        ];
        for (const param of TRACKING_PARAMS) {
            url.searchParams.delete(param);
        }
        return url.toString();
    }
    catch {
        return raw;
    }
};
/**
 * Strip dosage form and packaging descriptors from a search query to isolate brand + strength.
 * E.g. "Gelusil MPS syrup" -> "Gelusil MPS", "Cefonac O syrup" -> "Cefonac O", "Volini gel" -> "Volini"
 */
export const stripFormDescriptors = (query) => query
    .replace(/\b(tablets?|capsules?|syrups?|suspension|liquids?|solutions?|expectorant|elixir|injections?|gels?|creams?|ointments?|drops?|sprays?|inhalers?|vials?|ampoules?|rotacaps?|respules?|pens?|chewable|chewables|oral|cough)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
// ---------------------------------------------------------------------------
// Per-unit price calculation helper
// ---------------------------------------------------------------------------
/**
 * Calculate per-unit price based on dosage form, total price in paise, and pack quantity.
 * Returns a formatted string (e.g. "₹12.34 / unit") or null if inputs are invalid.
 */
export const calculatePerUnitPrice = (pricePaise, packQuantity, dosageForm) => {
    if (pricePaise == null || pricePaise <= 0 || packQuantity == null || packQuantity <= 0) {
        return null;
    }
    const form = (dosageForm ?? '').toLowerCase().trim();
    const priceRupees = pricePaise / 100;
    // 1. Tablets, Capsules, Patches, Sachets, Powders -> price per unit
    if (form.includes('tablet') ||
        form.includes('capsule') ||
        form.includes('patch') ||
        form.includes('sachet') ||
        form.includes('powder')) {
        const perUnit = priceRupees / packQuantity;
        return `₹${perUnit.toFixed(2)} / unit`;
    }
    // 2. Syrup, Suspension, Oral Liquid, Solution, Expectorant -> price per 5 ml
    if (form.includes('syrup') ||
        form.includes('suspension') ||
        form.includes('liquid') ||
        form.includes('solution') ||
        form.includes('expectorant') ||
        form.includes('elixir')) {
        const per5ml = (priceRupees / packQuantity) * 5;
        return `₹${per5ml.toFixed(2)} / 5ml`;
    }
    // 3. Cream, Gel, Ointment -> price per gram
    if (form.includes('cream') || form.includes('gel') || form.includes('ointment')) {
        const perGram = priceRupees / packQuantity;
        return `₹${perGram.toFixed(2)} / g`;
    }
    // 4. Drops, Eye/Ear/Nasal Drops, Spray -> price per ml
    if (form.includes('drop') || form.includes('spray')) {
        const perMl = priceRupees / packQuantity;
        return `₹${perMl.toFixed(2)} / ml`;
    }
    // 5. Injection, Vial, Ampoule, Pen -> price per ml
    if (form.includes('injection') || form.includes('vial') || form.includes('ampoule') || form.includes('pen')) {
        const perMl = priceRupees / packQuantity;
        return `₹${perMl.toFixed(2)} / ml`;
    }
    // 6. Inhaler, Rotacap, Respule -> price per dose
    if (form.includes('inhaler') ||
        form.includes('rotacap') ||
        form.includes('respule') ||
        form.includes('mdi') ||
        form.includes('synchrobreathe')) {
        const perDose = priceRupees / packQuantity;
        return `₹${perDose.toFixed(2)} / dose`;
    }
    // Fallback: simple price per unit of volume/weight/count
    const fallbackUnit = form.includes('ml') ? 'ml' : form.includes('gm') || form.includes('g') ? 'g' : 'unit';
    const perFallback = priceRupees / packQuantity;
    return `₹${perFallback.toFixed(2)} / ${fallbackUnit}`;
};
// ---------------------------------------------------------------------------
// Parser utilities
// ---------------------------------------------------------------------------
export { parseMedicineTitle } from './parser.js';
// ---------------------------------------------------------------------------
// SSR extraction utilities
// ---------------------------------------------------------------------------
export { extractEmbeddedJSON } from './extract-embedded-json.js';
//# sourceMappingURL=index.js.map