import type { BrowserContext, Page } from 'playwright';

// Helper to run page.evaluate safely with a hard timeout (prevents anti-bot script deadlocks)
export const safeEvaluate = async <T>(page: Page, pageFunction: any, arg?: any, timeoutMs = 400): Promise<T | null> => {
  try {
    const res = await Promise.race([
      page.evaluate(pageFunction, arg),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return res as T | null;
  } catch {
    return null;
  }
};

export const textFrom = async (page: Page, selector: string): Promise<string | null> => {
  return safeEvaluate<string>(page, (sel: string) => {
    const el = document.querySelector(sel);
    return el?.textContent?.trim() || null;
  }, selector);
};

export const firstHref = async (page: Page, selector: string): Promise<string | null> => {
  return safeEvaluate<string>(page, (sel: string) => {
    const el = document.querySelector(sel);
    return el?.getAttribute('href') || null;
  }, selector);
};

export const extractManufacturer = async (page: Page, fallbackSelectors: string[]): Promise<string | null> => {
  return safeEvaluate<string>(page, (selectors: string[]) => {
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
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) {
        const name = el.textContent.trim();
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
    }
    return null;
  }, fallbackSelectors);
};

const ALLOWED_RETAILER_DOMAINS = ['1mg.com', 'netmeds.com', 'pharmeasy.in', 'serpapi.com'];

export const createOptimizedPage = async (context: BrowserContext): Promise<Page> => {
  const page = await context.newPage();

  // Set up request interception to block heavy assets, anti-bot tracking scripts, and unapproved domains
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    const url = route.request().url();

    let isAllowedDomain = false;
    try {
      const hostname = new URL(url).hostname;
      isAllowedDomain = ALLOWED_RETAILER_DOMAINS.some((d) => hostname.endsWith(d));
    } catch {
      isAllowedDomain = false;
    }

    if (!isAllowedDomain) {
      route.abort();
      return;
    }

    if (
      ['image', 'media', 'font', 'stylesheet'].includes(resourceType) ||
      url.includes('google-analytics') ||
      url.includes('doubleclick') ||
      url.includes('facebook') ||
      url.includes('analytics') ||
      url.includes('hotjar') ||
      url.includes('akamai') ||
      url.includes('datadog') ||
      url.includes('telemetry')
    ) {
      route.abort();
    } else {
      route.continue();
    }
  });

  return page;
};
