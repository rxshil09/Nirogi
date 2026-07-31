import type { SourceOffer } from '@nirogi/contracts';
import { parsePercentage, parseRupeesToPaise } from '@nirogi/domain';
import { createOptimizedPage, safeEvaluate, textFrom } from '../lib/page.js';
import { loadFixtureOffer } from '../lib/fixtures.js';
import { discoverProductUrl } from '../services/serp-api.js';
import { pincodeToCity } from '../lib/pincode.js';
import { tryOneMgSSR } from './one-mg-ssr.js';
import type { RetailerAdapter, SearchInput } from './types.js';

export class OneMgAdapter implements RetailerAdapter {
  readonly retailer = 'one-mg' as const;

  async search(input: SearchInput): Promise<SourceOffer | null> {
    const fixtureOffer = await loadFixtureOffer(this.retailer, input.query);
    if (fixtureOffer) {
      process.stdout.write(`[one-mg] Fixture hit for "${input.query}"\n`);
      return fixtureOffer;
    }

    const t0 = Date.now();

    // ── Tier 1: SSR fetch directly on search query ──────────────────────────
    const ssrOffer = await tryOneMgSSR(input.query);
    if (ssrOffer) return ssrOffer;

    // ── Tier 2: SerpAPI Discovery retry if Tier 1 query SSR missed ───────────
    const cachedUrl = await discoverProductUrl(
      input.query,
      '1mg.com',
      (url) => url.hostname.includes('1mg.com') && url.pathname.length > 2,
      this.retailer,
    );

    if (cachedUrl) {
      const ssrDetailOffer = await tryOneMgSSR(cachedUrl);
      if (ssrDetailOffer) return ssrDetailOffer;
    }

    const sourceUrl = cachedUrl || `https://www.1mg.com/search/all?name=${encodeURIComponent(input.query)}`;

    // ── Tier 3: Playwright DOM scrape ────────────────────────────────────────
    process.stdout.write(`[one-mg] Tier 1 missed — falling back to Playwright Tier 3\n`);

    try {
      const context = await input.browser.newContext();
      try {
        const page = await createOptimizedPage(context);
        await Promise.race([
          page.goto(sourceUrl, { waitUntil: 'commit', timeout: 3_000 }).catch(() => null),
          new Promise((resolve) => setTimeout(resolve, 3_500)),
        ]);
        await page.waitForTimeout(300);

        // Handle location setting if pincode provided
        const city = pincodeToCity(input.pincode);
        if (city) {
          try {
            await safeEvaluate(page, () => {
              const el = document.querySelector('div[class*="location-name"], span[class*="location-name"], div[class*="CitySelector"], div#location-selector');
              if (el) (el as HTMLElement).click();
            });

            const locInput = page.locator('input#srchLsttXT, input[placeholder*="city" i], input[placeholder*="location" i]').first();
            if (await locInput.waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false)) {
              await locInput.click();
              await locInput.fill(city);
              await page.waitForTimeout(300);

              const dropdownItem = page.locator('ul[class*="city"] li, div[class*="city-name"], ul li').first();
              if (await dropdownItem.waitFor({ state: 'visible', timeout: 1000 }).then(() => true).catch(() => false)) {
                await dropdownItem.click();
              } else {
                await locInput.press('Enter');
              }
              await page.waitForTimeout(400);
            }
          } catch {
            // ignore error if location selector is missing
          }
        }

        const rawTitle = await textFrom(page, 'h1, div[class*="style__pro-title"], div[class*="ProductCard__product-name"], div[class*="style__product-description"], div[class*="style__title"]');
        const packSizeText = await textFrom(page, 'div[class*="pack-size"], div[class*="packSize"], div.headingSmallBold, span[class*="pack-size"], div.style__pack-size___, div[class*="style__pack-size"], div[class*="style__pack"]');

        const sourceTitle = rawTitle && packSizeText && !rawTitle.toLowerCase().includes(packSizeText.toLowerCase())
          ? `${rawTitle} ${packSizeText}`
          : (rawTitle || 'Medicine listing');

        let priceText = await textFrom(page, 'div.displaySmallExtraBold span, [class*="PriceBox"] span, div[class*="Price"] span');
        let mrpText = await textFrom(page, 'div.headingExtraSmallRegular.textStrikethrough, [class*="mrp"] span, span.marked-price');
        const discountText = await textFrom(page, "div.headingExtraSmallExtraBold[class*='BestOfferView'], [class*='discount']");

        const availabilityInfo = await safeEvaluate<{ isNotForSale: boolean; isOutOfStock: boolean; fallbackPrice: string | null; fallbackMrp: string | null }>(page, () => {
          const text = document.body.innerText || '';
          const isNotForSale = /not for sale|we do not facilitate sale/i.test(text);
          const isOutOfStock = /out of stock|currently unavailable|sold out/i.test(text);

          let fallbackPrice = null;
          let fallbackMrp = null;
          const prices = text.match(/₹\s*(\d+(?:\.\d+)?)/g);
          if (prices && prices.length > 0) {
            fallbackPrice = prices[0];
            if (prices.length > 1) fallbackMrp = prices[1];
          }

          return { isNotForSale, isOutOfStock, fallbackPrice, fallbackMrp };
        });

        if (!priceText && availabilityInfo?.fallbackPrice) {
          priceText = availabilityInfo.fallbackPrice;
        }
        if (!mrpText && availabilityInfo?.fallbackMrp) {
          mrpText = availabilityInfo.fallbackMrp;
        }

        let availability: 'in_stock' | 'out_of_stock' | 'not_for_sale' | 'unknown' = 'unknown';
        if (availabilityInfo?.isNotForSale) {
          availability = 'not_for_sale';
        } else if (availabilityInfo?.isOutOfStock) {
          availability = 'out_of_stock';
        } else if (priceText) {
          availability = 'in_stock';
        }

        const manufacturerName = await safeEvaluate<string>(page, () => {
          const blocklist = ['1mg', 'tata', 'netmeds', 'pharmeasy', 'google', 'healthkart', 'retailer'];
          const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          for (const s of scripts) {
            try {
              const data = JSON.parse(s.textContent || '');
              const items = Array.isArray(data) ? data : [data];
              for (const item of items) {
                if (item['@type'] === 'Product' || item['@type'] === 'ProductModel') {
                  const name = item.brand?.name || item.brand || item.manufacturer?.name || item.manufacturer;
                  if (name && typeof name === 'string') {
                    const lowerName = name.toLowerCase();
                    let blocklisted = false;
                    for (const term of blocklist) {
                      if (lowerName.includes(term)) {
                        blocklisted = true;
                        break;
                      }
                    }
                    if (!blocklisted) return name.trim();
                  }
                }
              }
            } catch {}
          }
          const mfrEl = document.querySelector('div[class*="DrugHeader__manufacturer"] a, div[class*="manufacturer"] a, [class*="manufacturer"]');
          if (mfrEl?.textContent?.trim()) {
            const name = mfrEl.textContent.trim();
            const lowerName = name.toLowerCase();
            let blocklisted = false;
            for (const term of blocklist) {
              if (lowerName.includes(term)) {
                blocklisted = true;
                break;
              }
            }
            if (!blocklisted) return name;
          }
          return null;
        });

        const fetchTimeMs = Date.now() - t0;
        process.stdout.write(
          `[one-mg] ${fetchTimeMs}ms — "${sourceTitle}" | price: ${priceText} | MRP: ${mrpText} | avail: ${availability} | mfr: ${manufacturerName ?? 'N/A'}\n`,
        );

        if (!sourceTitle && !priceText) {
          process.stdout.write(`[one-mg] Empty result — possible bot block\n`);
          return null;
        }

        return {
          retailer: this.retailer,
          sourceTitle,
          sourceUrl,
          pricePaise: parseRupeesToPaise(priceText),
          mrpPaise: parseRupeesToPaise(mrpText),
          discountPercent: parsePercentage(discountText),
          manufacturerName: manufacturerName ?? null,
          availability,
          collectedAt: new Date().toISOString(),
          matchStatus: 'candidate',
          fetchTimeMs,
          tierUsed: 'tier3_playwright',
        };
      } finally {
        await context.close();
      }
    } catch (err) {
      process.stdout.write(`[one-mg] Playwright Tier 3 failed: ${(err as Error).message}\n`);
      return null;
    }
  }
}
