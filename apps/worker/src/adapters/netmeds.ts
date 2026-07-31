import type { SourceOffer } from '@nirogi/contracts';
import { parsePercentage, parseRupeesToPaise } from '@nirogi/domain';
import { createOptimizedPage, textFrom } from '../lib/page.js';
import { loadFixtureOffer } from '../lib/fixtures.js';
import { discoverProductUrl } from '../services/serp-api.js';
import { tryNetmedsSSR } from './netmeds-ssr.js';
import type { RetailerAdapter, SearchInput } from './types.js';

export class NetmedsAdapter implements RetailerAdapter {
  readonly retailer = 'netmeds' as const;

  async search(input: SearchInput): Promise<SourceOffer | null> {
    const fixtureOffer = await loadFixtureOffer(this.retailer, input.query);
    if (fixtureOffer) {
      process.stdout.write(`[netmeds] Fixture hit for "${input.query}"\n`);
      return fixtureOffer;
    }

    const t0 = Date.now();

    // ── Tier 1: SSR fetch from Netmeds search/listing page ──────────────────
    const ssrOffer = await tryNetmedsSSR(input.query);
    if (ssrOffer) return ssrOffer;

    // ── Tier 2: SerpAPI Discovery retry if Tier 1 query SSR missed ───────────
    const cachedUrl = await discoverProductUrl(
      input.query,
      'netmeds.com',
      (url) => url.hostname.includes('netmeds.com') && url.pathname.length > 2,
      this.retailer,
    );

    if (cachedUrl) {
      const ssrDetailOffer = await tryNetmedsSSR(cachedUrl);
      if (ssrDetailOffer) return ssrDetailOffer;
    }

    const sourceUrl = cachedUrl || `https://www.netmeds.com/products?q=${encodeURIComponent(input.query)}`;

    // ── Tier 3: Playwright DOM scrape ────────────────────────────────────────
    process.stdout.write(`[netmeds] Tier 1 missed — falling back to Playwright Tier 3\n`);

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
        if (input.pincode) {
          try {
            await page.evaluate(() => {
              const el = document.querySelector('div.deliver-to, div[class*="deliver"], span#delivery_details, div.pincode, [class*="pincode"]');
              if (el) (el as HTMLElement).click();
            });

            const pinInput = page.locator('input.did-floating-input, input#pin_code, input#pincode, input[placeholder*="pincode" i]').first();
            if (await pinInput.waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false)) {
              await pinInput.click();
              await pinInput.fill(input.pincode);
              await page.waitForTimeout(300);
              await pinInput.press('Enter');
              await page.locator('button:has-text("Apply"), a:has-text("Apply"), button:has-text("CHECK"), [class*="apply"] button').first().click({ timeout: 1200 }).catch(() => null);
              await page.waitForTimeout(800);
            }
          } catch {
            // ignore error if selector is missing
          }
        }

        await page.locator('h1').first().waitFor({ timeout: 6_000 }).catch(() => undefined);

        const rawTitle = await textFrom(page, 'h1.prod-name, h1[class*="prod-name"], h1[class*="title"], h1[class*="name"], h1');
        const packSizeText = await textFrom(page, 'div[class*="pack-size"], span[class*="pack-size"], [class*="product-qty"], [class*="strip-size"], [class*="quantity"]');

        const sourceTitle = rawTitle && packSizeText && !rawTitle.toLowerCase().includes(packSizeText.toLowerCase())
          ? `${rawTitle} ${packSizeText}`
          : (rawTitle || 'Medicine listing');

        const extractedInfo = await page.evaluate(() => {
          const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          let jsonPrice = null;
          let jsonMrp = null;
          for (const s of scripts) {
            try {
              const data = JSON.parse(s.textContent || '');
              const items = Array.isArray(data) ? data : [data];
              for (const item of items) {
                if (item['@type'] === 'Product' || item['@type'] === 'Offer') {
                  const p = item.offers?.price || item.price;
                  const m = item.offers?.highPrice || item.mrp;
                  if (p) {
                    jsonPrice = String(p);
                    jsonMrp = m ? String(m) : null;
                    break;
                  }
                }
              }
            } catch {}
          }

          const priceEl = document.querySelector(
            'span.effective-price-div, [class*="effective-price"], [class*="final-price"], [class*="finalPrice"], span.price, span#unit_price, [class*="price-box"]'
          );
          let domPrice = null;
          if (priceEl) {
            const clone = priceEl.cloneNode(true) as Element;
            const discountSpans = clone.querySelectorAll('span');
            for (let i = 0; i < discountSpans.length; i++) {
              const s = discountSpans[i];
              if (s && (s.classList.contains('off') || s.textContent?.includes('%'))) {
                s.remove();
              }
            }
            domPrice = clone.textContent?.trim() || null;
          }

          const mrpEl = document.querySelector('span.marked-price, [class*="marked-price"], [class*="mrpPrice"], div.mrp-strick, [class*="mrp"]');
          const domMrp = mrpEl?.textContent?.trim() || null;

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

          return {
            price: domPrice || jsonPrice || fallbackPrice,
            mrp: domMrp || jsonMrp || fallbackMrp,
            isNotForSale,
            isOutOfStock,
          };
        });

        const priceText = extractedInfo.price;
        const mrpText = extractedInfo.mrp;

        let availability: 'in_stock' | 'out_of_stock' | 'not_for_sale' | 'unknown' = 'unknown';
        if (extractedInfo.isNotForSale) {
          availability = 'not_for_sale';
        } else if (extractedInfo.isOutOfStock) {
          availability = 'out_of_stock';
        } else if (priceText) {
          availability = 'in_stock';
        }

        const manufacturerName = await page.evaluate(() => {
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
                    if (!blocklisted) {
                      return name.trim();
                    }
                  }
                }
              }
            } catch {}
          }
          const brandEl = document.querySelector(
            'div.brand-name span.brand-name, [class*="brand-name"], [class*="manufacturer"], a[href*="marketer"]'
          );
          if (brandEl?.textContent?.trim()) {
            const name = brandEl.textContent.trim();
            const lowerName = name.toLowerCase();
            let blocklisted = false;
            for (const term of blocklist) {
              if (lowerName.includes(term)) {
                blocklisted = true;
                break;
              }
            }
            if (!blocklisted) {
              return name;
            }
          }
          return null;
        }) as string | null;

        const fetchTimeMs = Date.now() - t0;
        process.stdout.write(
          `[netmeds] ${fetchTimeMs}ms — "${sourceTitle}" | price: ${priceText} | MRP: ${mrpText ?? 'N/A'} | avail: ${availability} | mfr: ${manufacturerName ?? 'N/A'}\n`,
        );

        if (!sourceTitle && !priceText) {
          process.stdout.write(`[netmeds] Empty result — possible bot block\n`);
          return null;
        }

        return {
          retailer: this.retailer,
          sourceTitle,
          sourceUrl,
          pricePaise: parseRupeesToPaise(priceText),
          mrpPaise: parseRupeesToPaise(mrpText),
          discountPercent: parsePercentage(null),
          manufacturerName: manufacturerName?.replace(/^Mkt:\s*/i, '').trim() ?? null,
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
      process.stdout.write(`[netmeds] Playwright Tier 3 failed: ${(err as Error).message}\n`);
      return null;
    }
  }
}
