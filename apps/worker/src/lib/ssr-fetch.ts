/**
 * Shared HTTP fetch wrapper for Tier 1 SSR data collection.
 *
 * Every Tier 1 request must set a realistic browser User-Agent and
 * Accept-Language so the server-rendered HTML is appropriate for an Indian
 * pharmacy user. Using full navigation headers prevents HTTP 405 / bot blocks.
 */

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_UA,
  'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Sec-Ch-Ua': '"Not A(Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

/**
 * Fetch the HTML of a URL with browser-like headers.
 *
 * @param url        - The URL to fetch.
 * @param timeoutMs  - Abort timeout in milliseconds (default: 8000).
 * @returns          The response body as a string.
 * @throws           On non-2xx status or timeout.
 */
export async function ssrFetch(url: string, timeoutMs = 8_000): Promise<string> {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`SSR fetch failed: HTTP ${response.status} for ${url}`);
  }

  return response.text();
}
