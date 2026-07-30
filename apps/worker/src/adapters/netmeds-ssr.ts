import { z } from 'zod';
import { extractEmbeddedJSON, parseRupeesToPaise, parsePercentage, normaliseQuery, stripFormDescriptors } from '@nirogi/domain';
import { ssrFetch } from '../lib/ssr-fetch.js';
import type { SourceOffer } from '@nirogi/contracts';

// ---------------------------------------------------------------------------
// Extractor function for Netmeds (supports Detail URLs & Search Queries with retry)
// ---------------------------------------------------------------------------

function extractPriceNumber(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number' || typeof val === 'string') return String(val);
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    const min = obj['min'] ?? obj['max'] ?? obj['effective'] ?? obj['marked'];
    if (min !== null && min !== undefined) return String(min);
  }
  return null;
}

export async function tryNetmedsSSR(queryOrUrl: string, isRetry = false): Promise<SourceOffer | null> {
  const t0 = Date.now();
  try {
    const isUrl = queryOrUrl.startsWith('http');
    const fetchUrl = isUrl ? queryOrUrl : `https://www.netmeds.com/products?q=${encodeURIComponent(queryOrUrl)}`;
    const html = await ssrFetch(fetchUrl, 8_000);

    const rawState = extractEmbeddedJSON(html, 'window.__INITIAL_STATE__=') as any;
    if (!rawState) return null;

    if (isUrl) {
      // ── Detail Page Extraction ─────────────────────────────────────────────
      const pd = rawState?.productDetailsPage;
      const productObj = pd?.product;
      const mainAttrs = productObj?.attributes || pd?.product_meta || {};

      if (!productObj && !mainAttrs.name) {
        process.stdout.write(`[netmeds] Tier 1: productDetailsPage empty for URL ${queryOrUrl}\n`);
        return null;
      }

      const rawName = (productObj?.name ?? mainAttrs.name ?? mainAttrs['mstar-displaynamewops'] ?? null)?.trim() ?? null;
      const packInfo = (mainAttrs['mstar-packlabel'] ?? mainAttrs.pack_size ?? null)?.trim() ?? null;
      const sourceTitle = rawName && packInfo && !rawName.toLowerCase().includes(packInfo.toLowerCase())
        ? `${rawName} ${packInfo}`
        : (rawName ?? null);

      const priceStr = extractPriceNumber(
        mainAttrs.min_price_effective ??
        mainAttrs.itemdiscount ??
        mainAttrs.mrp ??
        productObj?.price?.effective ??
        null
      );
      const mrpStr = extractPriceNumber(
        mainAttrs.mrp ??
        productObj?.price?.marked ??
        null
      );
      const discountRaw = mainAttrs.discount ?? mainAttrs['mstar-discountpct'] ?? null;

      const pricePaise = parseRupeesToPaise(priceStr);
      const mrpPaise = parseRupeesToPaise(mrpStr);
      const discountPercent = parsePercentage(discountRaw !== null ? String(discountRaw) : null);

      const isAvail = mainAttrs.is_available ?? (mainAttrs.activestatus === 'true' || mainAttrs.activestatus === true) ?? null;
      let availability: 'in_stock' | 'out_of_stock' | 'not_for_sale' | 'unknown' = 'unknown';
      if (isAvail === true && pricePaise !== null) {
        availability = 'in_stock';
      } else if (isAvail === false) {
        availability = 'out_of_stock';
      } else if (pricePaise !== null) {
        availability = 'in_stock';
      }

      const manufacturerName = (
        mainAttrs.marketerName ??
        mainAttrs.manufacturername ??
        mainAttrs.brandFilter ??
        mainAttrs.brand ??
        null
      )?.trim() || null;

      const fetchTimeMs = Date.now() - t0;
      process.stdout.write(`[netmeds] Tier 1 SSR detail hit ${fetchTimeMs}ms — "${sourceTitle}" | price: ${priceStr} | mfr: ${manufacturerName ?? 'N/A'}\n`);

      return {
        retailer: 'netmeds',
        sourceTitle,
        sourceUrl: queryOrUrl,
        pricePaise,
        mrpPaise,
        discountPercent,
        manufacturerName,
        availability,
        collectedAt: new Date().toISOString(),
        matchStatus: 'candidate',
        fetchTimeMs,
        tierUsed: 'tier1_ssr',
      };
    } else {
      // ── Search Page Extraction ─────────────────────────────────────────────
      const items = rawState?.productListingPage?.productlists?.items;
      const rawList = Array.isArray(items) ? items : [];

      const queryTokens = normaliseQuery(queryOrUrl).split(' ').filter((t) => t.length > 1);
      const brandToken = queryTokens[0] || normaliseQuery(queryOrUrl);

      const matchingProduct = rawList.find((item: any) => {
        const normName = normaliseQuery(item.name || '');
        return normName.includes(brandToken);
      });

      if (!matchingProduct) {
        // Stage 2: Retry with stripped brand query
        const cleanQuery = stripFormDescriptors(queryOrUrl);
        if (!isRetry && cleanQuery.length > 2 && cleanQuery !== queryOrUrl) {
          process.stdout.write(`[netmeds] Retrying search with stripped brand "${cleanQuery}"...\n`);
          return tryNetmedsSSR(cleanQuery, true);
        }

        process.stdout.write(`[netmeds] Tier 1 query SSR: no product matching brand "${brandToken}" in search results\n`);
        return null;
      }

      const best = matchingProduct;
      const sourceUrl = best.url
        ? (best.url.startsWith('http') ? best.url : `https://www.netmeds.com${best.url}`)
        : (best.slug ? `https://www.netmeds.com/product/${best.slug}` : null);

      const sourceTitle = (best.name ?? '').trim() || null;

      const priceStr = extractPriceNumber(best.price?.effective);
      const mrpStr = extractPriceNumber(best.price?.marked);
      const discountRaw = best.discount ?? null;

      const pricePaise = parseRupeesToPaise(priceStr);
      const mrpPaise = parseRupeesToPaise(mrpStr);
      const discountPercent = parsePercentage(discountRaw !== null ? String(discountRaw) : null);

      // sellable=true means the product CAN be sold by Netmeds.
      // is_active reflects pincode-based slot availability but is often false without a pincode.
      // A product with sellable=true and a price is reliably in_stock.
      let availability: 'in_stock' | 'out_of_stock' | 'not_for_sale' | 'unknown' = 'unknown';
      if (best.sellable === true && pricePaise !== null) availability = 'in_stock';
      else if (best.sellable === false) availability = 'out_of_stock';
      else if (pricePaise !== null) availability = 'in_stock';

      const brandObjName = typeof best.brand === 'object' && best.brand !== null ? best.brand.name : (typeof best.brand === 'string' ? best.brand : null);
      const manufacturerName = (
        best.attributes?.manufacturername ??
        best.attributes?.marketername ??
        best.attributes?.brand_name ??
        best.brand_name ??
        brandObjName ??
        null
      )?.trim() || null;

      const fetchTimeMs = Date.now() - t0;
      process.stdout.write(`[netmeds] Tier 1 SSR search hit ${fetchTimeMs}ms — "${sourceTitle}" | price: ${priceStr} | avail: ${availability} | mfr: ${manufacturerName ?? 'N/A'}\n`);

      if (!sourceTitle && pricePaise === null) return null;

      return {
        retailer: 'netmeds',
        sourceTitle,
        sourceUrl,
        pricePaise,
        mrpPaise,
        discountPercent,
        manufacturerName,
        availability,
        collectedAt: new Date().toISOString(),
        matchStatus: 'candidate',
        fetchTimeMs,
        tierUsed: 'tier1_ssr',
      };
    }
  } catch (err) {
    const fetchTimeMs = Date.now() - t0;
    process.stdout.write(`[netmeds] Tier 1 failed (${fetchTimeMs}ms): ${(err as Error).message}\n`);
    return null;
  }
}
