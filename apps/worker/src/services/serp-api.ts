import { z } from 'zod';
import type { RetailerSlug } from '@nirogi/contracts';

const SerpApiResponseSchema = z.object({
  organic_results: z
    .array(
      z.object({
        link: z.string().url(),
        title: z.string().optional(),
      }),
    )
    .optional(),
});

export const discoverProductUrl = async (
  query: string,
  siteDomain: string,
  validator: (url: URL) => boolean,
  retailer: RetailerSlug,
): Promise<string | null> => {
  // ── SerpAPI Google Search with Hard AbortController Timeout ──────────────────
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const searchParam = `${query} site:${siteDomain}`;
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', searchParam);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('num', '5');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const payload = SerpApiResponseSchema.parse(await response.json());

    if (payload.organic_results) {
      for (const result of payload.organic_results) {
        try {
          const candidateUrl = new URL(result.link);
          if (validator(candidateUrl)) {
            process.stdout.write(`[serp-api] Discovered product URL for "${query}" on ${siteDomain}: ${result.link}\n`);
            return result.link;
          }
        } catch {
          // ignore malformed URLs
        }
      }
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }

  return null;
};
