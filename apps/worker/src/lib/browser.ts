import { chromium, type Browser, type BrowserContext } from 'playwright';

/**
 * Manages a single shared Chromium browser process.
 * Each caller gets an isolated BrowserContext (separate cookies/storage)
 * but they all share the same OS process — saving 3-5s of cold-start time
 * per additional adapter.
 */
export class SharedBrowser {
  private browser: Browser | null = null;

  async launch(): Promise<void> {
    if (this.browser) return;
    this.browser = await chromium.launch({
      headless: process.env.SCRAPER_HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    process.stdout.write('[browser] Chromium launched (shared instance)\n');
  }

  /**
   * Returns a fresh isolated context (like a private window) from the shared browser.
   * The caller is responsible for closing the context when done.
   */
  async newContext(): Promise<BrowserContext> {
    if (!this.browser) {
      await this.launch();
    }
    return this.browser!.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      // Mask automation signals
      extraHTTPHeaders: {
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      process.stdout.write('[browser] Chromium closed\n');
    }
  }
}
