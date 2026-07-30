import { z } from 'zod';
import { parseRupeesToPaise, parsePercentage, normaliseQuery, stripFormDescriptors } from '@nirogi/domain';
import { ssrFetch } from '../lib/ssr-fetch.js';
import type { SourceOffer } from '@nirogi/contracts';

// ---------------------------------------------------------------------------
// Extractor function for PharmEasy (supports Detail URLs & Search Queries with retry)
// ---------------------------------------------------------------------------

export async function tryPharmEasySSR(queryOrUrl: string, isRetry = false): Promise<SourceOffer | null> {
  const t0 = Date.now();
  try {
    const isUrl = queryOrUrl.startsWith('http');
    const fetchUrl = isUrl ? queryOrUrl : `https://pharmeasy.in/search/all?name=${encodeURIComponent(queryOrUrl)}`;
    const html = await ssrFetch(fetchUrl, 8_000);

    const match = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]*?)<\/script>/);
    if (!match || !match[1]) {
      process.stdout.write(`[pharmeasy] Tier 1: __NEXT_DATA__ not found\n`);
      return null;
    }

    const rawData = JSON.parse(match[1]);
    const pageProps = rawData.props?.pageProps;

    if (isUrl) {
      // ── Detail page extraction ─────────────────────────────────────────────
      let product = pageProps?.productDetails;
      if (!product && pageProps) {
        product = (pageProps['product'] ?? pageProps['productData'] ?? pageProps['item'] ?? null);
      }
      if (!product) return null;

      const rawName = product.name?.trim() ?? null;
      const packInfo = (product.measurementUnit ?? product.measurement_unit ?? product.packSize ?? product.pack_size)?.trim() ?? null;
      const sourceTitle = rawName && packInfo && !rawName.toLowerCase().includes(packInfo.toLowerCase())
        ? `${rawName} ${packInfo}`
        : (rawName ?? null);

      const priceRaw = product.salePrice ?? product.sale_price ?? product.salePriceDecimal ?? product.price ?? product.finalPrice ?? product.discountedPrice ?? product.offerPrice ?? null;
      const mrpRaw = product.costPrice ?? product.cost_price ?? product.mrpDecimal ?? product.mrp ?? product.actualPrice ?? null;
      const discountRaw = product.discountPercent ?? product.discount_percent ?? null;

      const pricePaise = parseRupeesToPaise(priceRaw !== null ? String(priceRaw) : null);
      const mrpPaise = parseRupeesToPaise(mrpRaw !== null ? String(mrpRaw) : null);
      const discountPercent = parsePercentage(discountRaw !== null ? String(discountRaw) : null);

      const inStockRaw = product.isAvailable ?? product.inStock ?? product.is_in_stock ?? product.available ?? null;
      let availability: 'in_stock' | 'out_of_stock' | 'unknown' = 'unknown';
      if (inStockRaw === true && pricePaise !== null) {
        availability = 'in_stock';
      } else if (inStockRaw === false) {
        availability = 'out_of_stock';
      } else if (pricePaise !== null) {
        availability = 'in_stock';
      }

      const manufacturerName = (product.manufacturer ?? product.manufacturerName ?? product.consumerBrandName ?? null)?.trim() || null;
      const fetchTimeMs = Date.now() - t0;
      process.stdout.write(`[pharmeasy] Tier 1 SSR hit ${fetchTimeMs}ms — "${sourceTitle}" | price: ${priceRaw}\n`);

      return {
        retailer: 'pharmeasy',
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
      // ── Search page extraction with strict brand matching & ad filtering ──
      const rawList = pageProps?.productList || pageProps?.genericsProductList || [];
      const productList = Array.isArray(rawList) ? rawList.filter((item: any) => item.isSponsored !== true) : [];

      // Extract primary brand token from query
      const queryTokens = normaliseQuery(queryOrUrl).split(' ').filter((t) => t.length > 1);
      const brandToken = queryTokens[0] || normaliseQuery(queryOrUrl);

      const matchingProduct = productList.find((item: any) => {
        const normName = normaliseQuery(item.name || '');
        return normName.includes(brandToken);
      });

      if (!matchingProduct) {
        // Stage 2: Retry with stripped brand query
        const cleanQuery = stripFormDescriptors(queryOrUrl);
        if (!isRetry && cleanQuery.length > 2 && cleanQuery !== queryOrUrl) {
          process.stdout.write(`[pharmeasy] Retrying query with stripped brand "${cleanQuery}"...\n`);
          return tryPharmEasySSR(cleanQuery, true);
        }

        process.stdout.write(`[pharmeasy] Tier 1 query SSR: no product matching brand "${brandToken}" in search results.\n`);
        return null;
      }

      const best = matchingProduct;
      const rawName = best.name?.trim() ?? null;
      const packInfo = (best.measurementUnit ?? best.subtitleText ?? best.packSize)?.trim() ?? null;
      const sourceTitle = rawName && packInfo && !rawName.toLowerCase().includes(packInfo.toLowerCase())
        ? `${rawName} ${packInfo}`
        : (rawName ?? null);

      const sourceUrl = best.slug ? `https://pharmeasy.in/online-medicine-order/${best.slug}` : null;
      const priceRaw = best.salePriceDecimal ?? best.salePrice ?? best.price ?? null;
      const mrpRaw = best.mrpDecimal ?? best.costPrice ?? best.mrp ?? null;
      const discountRaw = best.discountPercent ?? best.discount ?? null;

      const pricePaise = parseRupeesToPaise(priceRaw !== null ? String(priceRaw) : null);
      const mrpPaise = parseRupeesToPaise(mrpRaw !== null ? String(mrpRaw) : null);
      const discountPercent = parsePercentage(discountRaw !== null ? String(discountRaw) : null);

      const isAvail = best.productAvailabilityFlags?.isAvailable ?? best.isAvailable ?? null;
      let availability: 'in_stock' | 'out_of_stock' | 'unknown' = 'unknown';
      if (isAvail === true && pricePaise !== null) availability = 'in_stock';
      else if (isAvail === false) availability = 'out_of_stock';
      else if (pricePaise !== null) availability = 'in_stock';

      const manufacturerName = (best.manufacturer ?? best.consumerBrandName ?? null)?.trim() || null;
      const fetchTimeMs = Date.now() - t0;
      process.stdout.write(`[pharmeasy] Tier 1 SSR hit ${fetchTimeMs}ms — "${sourceTitle}" | price: ${priceRaw} | mfr: ${manufacturerName ?? 'N/A'}\n`);

      return {
        retailer: 'pharmeasy',
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
    process.stdout.write(`[pharmeasy] Tier 1 failed (${fetchTimeMs}ms): ${(err as Error).message}\n`);
    return null;
  }
}
