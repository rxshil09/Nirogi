import type { RetailerSlug, SourceOffer } from '@nirogi/contracts';
import type { SharedBrowser } from '../lib/browser.js';

export interface SearchInput {
  query: string;
  pincode?: string;
  /** Shared browser instance. When provided, adapters use it instead of launching their own. */
  browser: SharedBrowser;
}

export interface RetailerAdapter {
  readonly retailer: RetailerSlug;
  search(input: SearchInput): Promise<SourceOffer | null>;
}
