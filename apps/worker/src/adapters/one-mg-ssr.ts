import { parseRupeesToPaise, parsePercentage, normaliseQuery, stripFormDescriptors } from '@nirogi/domain';
import { ssrFetch } from '../lib/ssr-fetch.js';
import type { SourceOffer } from '@nirogi/contracts';

// ---------------------------------------------------------------------------
// Extractor function for 1mg (supports Detail URLs, Autocomplete & Search Pages)
// ---------------------------------------------------------------------------

export async function tryOneMgSSR(queryOrUrl: string, isRetry = false): Promise<SourceOffer | null> {
  const t0 = Date.now();
  try {
    const isUrl = queryOrUrl.startsWith('http');

    if (isUrl) {
      // ── Detail Page Extraction ─────────────────────────────────────────────
      const html = await ssrFetch(queryOrUrl, 8_000);
      const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*/);
      if (!stateMatch || stateMatch.index === undefined) return null;
      const jsonStart = stateMatch.index + stateMatch[0].length;

      let depth = 0, inStr = false, escaped = false, end = -1;
      for (let i = jsonStart; i < html.length; i++) {
        const ch = html[i];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\\\') { escaped = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === '{') depth++;
        if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
      }
      if (end === -1) return null;

      const rawState = JSON.parse(html.slice(jsonStart, end).trim().replace(/;$/, ''));
      const pageReducer = rawState.otcPageReducer || rawState.drugPageReducer || rawState.productDetailReducer || rawState.skuPageReducer || rawState.pdpReducer || rawState;
      if (!pageReducer) return null;

      const dynamicData = pageReducer.dynamicData || rawState.dynamicData;
      const staticData = pageReducer.staticData || rawState.staticData;
      const priceBox = dynamicData?.priceBox || rawState.priceBox;
      const mixpanel = priceBox?.mixpanelData || rawState.mixpanelData;
      const sku = staticData?.sku || rawState.sku;

      const rawName = sku?.name ?? mixpanel?.sku_name ?? null;
      const packInfo = sku?.pack_size_info ?? priceBox?.packSizes ?? null;
      const sourceTitle = rawName && packInfo && !rawName.toLowerCase().includes(packInfo.toLowerCase())
        ? `${rawName.trim()} ${packInfo.trim()}`
        : (rawName?.trim() ?? null);

      const priceRaw = mixpanel?.list_price ?? priceBox?.price ?? sku?.selling_price ?? sku?.price ?? mixpanel?.price ?? null;
      const mrpRaw = mixpanel?.mrp ?? priceBox?.mrp ?? sku?.mrp ?? null;
      const discountRaw = mixpanel?.discount_percent ?? priceBox?.discount ?? null;
      if (!sourceTitle || priceRaw === null) return null;

      const pricePaise = parseRupeesToPaise(priceRaw !== null ? String(priceRaw) : null);
      const mrpPaise = parseRupeesToPaise(mrpRaw !== null ? String(mrpRaw) : null);
      const discountPercent = parsePercentage(discountRaw !== null ? String(discountRaw) : null);

      const inStockRaw = priceBox?.isSkuInStock ?? sku?.in_stock ?? null;
      let availability: 'in_stock' | 'out_of_stock' | 'unknown' = 'unknown';
      if (inStockRaw === true && pricePaise !== null) availability = 'in_stock';
      else if (inStockRaw === false) availability = 'out_of_stock';
      else if (pricePaise !== null) availability = 'in_stock';

      const manufacturerName = (sku?.marketer_name ?? sku?.manufacturer_name ?? sku?.brand_name ?? null)?.trim() || null;
      const fetchTimeMs = Date.now() - t0;
      process.stdout.write(`[one-mg] Tier 1 SSR hit ${fetchTimeMs}ms — "${sourceTitle}" | price: ${priceRaw}\n`);

      return {
        retailer: 'one-mg',
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
      // ── Stage 1: Search Autocomplete API Extraction ────────────────────────
      const apiUrl = `https://www.1mg.com/api/v1/search/autocomplete?name=${encodeURIComponent(queryOrUrl)}`;
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'Accept-Language': 'en-IN',
        },
        signal: AbortSignal.timeout(8_000),
      });

      if (res.ok) {
        const data = await res.json();
        const rawResults = data.results || data.data?.results || data.products || [];
        if (Array.isArray(rawResults) && rawResults.length > 0) {
          const queryTokens = normaliseQuery(queryOrUrl).split(' ').filter((t) => t.length > 1);
          const brandToken = queryTokens[0] || normaliseQuery(queryOrUrl);

          const matchingItem = rawResults.find((item: any) => {
            const cleanName = (item.label || item.name || '').replace(/<[^>]*>/g, '');
            return normaliseQuery(cleanName).includes(brandToken);
          });

          if (matchingItem) {
            const best = matchingItem;
            const rawName = (best.label || best.name || '').replace(/<[^>]*>/g, '').trim();
            const packInfo = (best.pack_size_label ?? best.pack_form)?.trim() ?? null;
            const sourceTitle = rawName && packInfo && !rawName.toLowerCase().includes(packInfo.toLowerCase())
              ? `${rawName} ${packInfo}`
              : (rawName || null);

            const sourceUrl = best.url_path ? `https://www.1mg.com${best.url_path}` : null;
            const priceRaw = best.discounted_price ?? best.price ?? null;

            // If autocomplete payload doesn't embed price, fetch detail page SSR for 100% price accuracy
            if (priceRaw === null && sourceUrl) {
              return tryOneMgSSR(sourceUrl);
            }

            const mrpRaw = best.price ?? null;
            const discountRaw = best.discount_percent ?? null;

            const pricePaise = parseRupeesToPaise(priceRaw !== null ? String(priceRaw) : null);
            const mrpPaise = parseRupeesToPaise(mrpRaw !== null ? String(mrpRaw) : null);
            const discountPercent = parsePercentage(discountRaw !== null ? String(discountRaw) : null);

            const isAvail = best.available ?? (best.saleable && !best.is_discontinued) ?? null;
            let availability: 'in_stock' | 'out_of_stock' | 'unknown' = 'unknown';
            if (isAvail === true && pricePaise !== null) availability = 'in_stock';
            else if (isAvail === false) availability = 'out_of_stock';
            else if (pricePaise !== null) availability = 'in_stock';

            const manufacturerName = (best.marketer_name ?? best.manufacturer_name ?? null)?.trim() || null;
            const fetchTimeMs = Date.now() - t0;
            process.stdout.write(`[one-mg] Tier 1 SSR hit ${fetchTimeMs}ms — "${sourceTitle}" | price: ${priceRaw} | mfr: ${manufacturerName ?? 'N/A'}\n`);

            return {
              retailer: 'one-mg',
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
        }
      }

      // ── Stage 2: 1mg HTML Search Page SSR Fallback ─────────────────────────
      const searchPageOffer = await tryOneMgSearchPageSSR(queryOrUrl, t0);
      if (searchPageOffer) return searchPageOffer;

      // ── Stage 3: Retry with stripped brand query ─────────────────────────────
      const cleanQuery = stripFormDescriptors(queryOrUrl);
      if (!isRetry && cleanQuery.length > 2 && cleanQuery !== queryOrUrl) {
        process.stdout.write(`[one-mg] Retrying search with stripped query "${cleanQuery}"...\n`);
        return tryOneMgSSR(cleanQuery, true);
      }

      return null;
    }
  } catch (err) {
    const fetchTimeMs = Date.now() - t0;
    process.stdout.write(`[one-mg] Tier 1 failed (${fetchTimeMs}ms): ${(err as Error).message}\n`);
    return null;
  }
}

async function tryOneMgSearchPageSSR(query: string, t0: number): Promise<SourceOffer | null> {
  try {
    const searchUrl = `https://www.1mg.com/search/all?name=${encodeURIComponent(query)}`;
    const html = await ssrFetch(searchUrl, 8_000);
    const marker = 'window.__INITIAL_STATE__ =';
    const start = html.indexOf(marker);
    if (start === -1) return null;

    let depth = 0, inStr = false, escaped = false, end = -1;
    for (let i = start + marker.length; i < html.length; i++) {
      const ch = html[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\\\') { escaped = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end === -1) return null;

    const rawState = JSON.parse(html.slice(start + marker.length, end).trim().replace(/;$/, ''));
    const skus = rawState.searchReducer?.searchData?.skus || rawState.searchReducer?.searchData?.products || [];
    if (!Array.isArray(skus) || skus.length === 0) return null;

    const queryTokens = normaliseQuery(query).split(' ').filter((t) => t.length > 1);
    const brandToken = queryTokens[0] || normaliseQuery(query);

    const matchingItem = skus.find((item: any) => {
      const normName = normaliseQuery(item.name || item.sku_name || '');
      return normName.includes(brandToken);
    });

    if (!matchingItem) return null;

    const best = matchingItem;
    const rawName = (best.name || best.sku_name || '').trim() || null;
    const packInfo = (best.pack_size_info || best.pack_size)?.trim() || null;
    const sourceTitle = rawName && packInfo && !rawName.toLowerCase().includes(packInfo.toLowerCase())
      ? `${rawName} ${packInfo}`
      : (rawName || null);

    const sourceUrl = best.url_path || best.slug ? `https://www.1mg.com${best.url_path || '/drugs/' + best.slug}` : null;
    const priceRaw = best.price ?? best.selling_price ?? best.list_price ?? null;
    const mrpRaw = best.mrp ?? null;
    const discountRaw = best.discount_percent ?? null;

    const pricePaise = parseRupeesToPaise(priceRaw !== null ? String(priceRaw) : null);
    const mrpPaise = parseRupeesToPaise(mrpRaw !== null ? String(mrpRaw) : null);
    const discountPercent = parsePercentage(discountRaw !== null ? String(discountRaw) : null);

    const isAvail = best.in_stock ?? best.isSkuInStock ?? true;
    let availability: 'in_stock' | 'out_of_stock' | 'unknown' = 'unknown';
    if (isAvail === true && pricePaise !== null) availability = 'in_stock';
    else if (isAvail === false) availability = 'out_of_stock';
    else if (pricePaise !== null) availability = 'in_stock';

    const manufacturerName = (best.marketer_name ?? best.manufacturer_name ?? null)?.trim() || null;
    const fetchTimeMs = Date.now() - t0;
    process.stdout.write(`[one-mg] Tier 1 SSR search page hit ${fetchTimeMs}ms — "${sourceTitle}" | price: ${priceRaw} | mfr: ${manufacturerName ?? 'N/A'}\n`);

    return {
      retailer: 'one-mg',
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
  } catch {
    return null;
  }
}
