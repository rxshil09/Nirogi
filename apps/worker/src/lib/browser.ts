import { chromium, type Browser, type BrowserContext, type BrowserContextOptions } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

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
   * Returns a fresh isolated context from the shared browser.
   * Optionally loads cached storageState file if present.
   */
  async newContext(storageStatePath?: string): Promise<BrowserContext> {
    if (!this.browser) {
      await this.launch();
    }

    const options: BrowserContextOptions = {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: {
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    };

    if (storageStatePath && fs.existsSync(storageStatePath)) {
      try {
        options.storageState = storageStatePath;
      } catch {
        // ignore invalid storageState
      }
    }

    return this.browser!.newContext(options);
  }

  async saveStorageState(context: BrowserContext, targetPath: string): Promise<void> {
    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      await context.storageState({ path: targetPath });
    } catch {
      // ignore storageState write errors
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      process.stdout.write('[browser] Chromium closed\n');
    }
  }
}
