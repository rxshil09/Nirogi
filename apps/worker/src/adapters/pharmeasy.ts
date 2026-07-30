import type { SourceOffer } from '@nirogi/contracts';
import { parsePercentage, parseRupeesToPaise } from '@nirogi/domain';
import { createOptimizedPage, textFrom } from '../lib/page.js';
import { loadFixtureOffer } from '../lib/fixtures.js';
import { discoverProductUrl } from '../services/serp-api.js';
import { tryPharmEasySSR } from './pharmeasy-ssr.js';
import type { RetailerAdapter, SearchInput } from './types.js';

export class PharmEasyAdapter implements RetailerAdapter {
  readonly retailer = 'pharmeasy' as const;

  async search(input: SearchInput): Promise<SourceOffer | null> {
    const fixtureOffer = await loadFixtureOffer(this.retailer, input.query);
    if (fixtureOffer) {
      process.stdout.write(`[pharmeasy] Fixture hit for "${input.query}"\n`);
      return fixtureOffer;
    }

    const t0 = Date.now();

    // ── Tier 1: SSR fetch directly on search query ──────────────────────────
    const ssrOffer = await tryPharmEasySSR(input.query);
    if (ssrOffer) return ssrOffer;

    // ── Tier 1b: Direct slug construction ──────────────────────────────────
    // PharmEasy's search often returns fuzzy unrelated results. Try a constructed
    // slug directly: "Qutipin 50 tablet" → /online-medicine-order/qutipin-50-tablet
    const slugCandidate = input.query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const slugUrl = `https://pharmeasy.in/online-medicine-order/${slugCandidate}`;
    process.stdout.write(`[pharmeasy] Trying direct slug: ${slugUrl}\n`);
    const slugOffer = await tryPharmEasySSR(slugUrl);
    if (slugOffer) return slugOffer;

    // ── Tier 2: SerpAPI Discovery retry if Tier 1 query SSR missed ───────────
    const cachedUrl = await discoverProductUrl(
      input.query,
      'pharmeasy.in',
      (url) => url.hostname.endsWith('pharmeasy.in') && url.pathname.includes('/online-medicine-order/'),
      this.retailer,
    );

    if (cachedUrl) {
      const ssrDetailOffer = await tryPharmEasySSR(cachedUrl);
      if (ssrDetailOffer) return ssrDetailOffer;
    }

    const sourceUrl = cachedUrl || `https://pharmeasy.in/search/all?name=${encodeURIComponent(input.query)}`;

    // ── Tier 3: Playwright DOM scrape ────────────────────────────────────────
    process.stdout.write(`[pharmeasy] Tier 1 missed — falling back to Playwright Tier 3\n`);

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
              const el = document.querySelector('[class*="pincodeDrawerTrigger"], div[class*="PincodeTrigger_pincodeDrawerTrigger"]');
              if (el) (el as HTMLElement).click();
            });

            const pinInput = page.locator('input[placeholder*="Pincode" i], input[placeholder*="pincode" i], input[type*="numeric"]').first();
            if (await pinInput.waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false)) {
              await pinInput.click();
              await pinInput.fill(input.pincode);
              await page.waitForTimeout(300);
              await pinInput.press('Enter');
              await page.locator('button:has-text("Check"), button:has-text("Apply"), [class*="apply"] button').first().click({ timeout: 1200 }).catch(() => null);
              await page.waitForTimeout(800);
            }
          } catch {
            // ignore error if selector is missing
          }
        }

        await page.locator('h1').first().waitFor({ timeout: 6_000 }).catch(() => undefined);

        const rawTitle = await textFrom(page, 'h1');
        const packSizeText = await textFrom(page, 'div[class*="packSize"], p[class*="packSize"], span[class*="packSize"], [class*="measurement"]');

        const sourceTitle = rawTitle && packSizeText && !rawTitle.toLowerCase().includes(packSizeText.toLowerCase())
          ? `${rawTitle} ${packSizeText}`
          : (rawTitle || 'Medicine listing');

        let priceText = await textFrom(page, 'p[class*="originalPrice"], [class*="originalPrice"]');
        let mrpText = await textFrom(page, 'p[class*="mrpPrice"], [class*="mrpPrice"]');
        const discountText = await textFrom(page, 'p[class*="discountPrice"], [class*="discountPrice"]');

        const availabilityInfo = await page.evaluate(() => {
          const text = document.body.innerText || '';
          const isNotForSale = /we do not sell this product|not for sale|we do not facilitate sale/i.test(text);
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

        if (!priceText && availabilityInfo.fallbackPrice) {
          priceText = availabilityInfo.fallbackPrice;
        }
        if (!mrpText && availabilityInfo.fallbackMrp) {
          mrpText = availabilityInfo.fallbackMrp;
        }

        let availability: 'in_stock' | 'out_of_stock' | 'not_for_sale' | 'unknown' = 'unknown';
        if (availabilityInfo.isNotForSale) {
          availability = 'not_for_sale';
        } else if (availabilityInfo.isOutOfStock) {
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
          const mfrEl = document.querySelector('[class*="manufacturerText"]');
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
            if (!blocklisted) {
              return name;
            }
          }
          const headers = Array.from(document.querySelectorAll('[class*="contentHeader"]'));
          for (const h of headers) {
            if (h.textContent?.trim() === 'Made by') {
              const content = h.nextElementSibling;
              if (content?.textContent?.trim()) {
                const name = content.textContent.trim();
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
            }
          }
          return null;
        }) as string | null;

        const fetchTimeMs = Date.now() - t0;
        process.stdout.write(
          `[pharmeasy] ${fetchTimeMs}ms — "${sourceTitle}" | price: ${priceText} | MRP: ${mrpText} | avail: ${availability} | mfr: ${manufacturerName ?? 'N/A'}\n`,
        );

        if (!sourceTitle && !priceText) {
          process.stdout.write(`[pharmeasy] Empty result — possible bot block\n`);
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
      process.stdout.write(`[pharmeasy] Playwright Tier 3 failed: ${(err as Error).message}\n`);
      return null;
    }
  }
}
