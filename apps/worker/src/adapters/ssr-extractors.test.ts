import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as ssrFetchModule from '../lib/ssr-fetch.js';
import { tryOneMgSSR } from './one-mg-ssr.js';
import { tryPharmEasySSR } from './pharmeasy-ssr.js';
import { tryNetmedsSSR } from './netmeds-ssr.js';

describe('Tier 1 SSR Extractors (Synthetic Fixtures)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('tryOneMgSSR parses 1mg HTML fixture correctly', async () => {
    const fixturePath = path.join(process.cwd(), 'apps', 'worker', 'tests', 'fixtures', 'ssr', 'one-mg-dolo-650.html');
    const html = fs.readFileSync(fixturePath, 'utf8');

    vi.spyOn(ssrFetchModule, 'ssrFetch').mockResolvedValue(html);

    const offer = await tryOneMgSSR('https://www.1mg.com/drugs/dolo-650-tablet-13495');

    expect(offer).not.toBeNull();
    expect(offer?.retailer).toBe('one-mg');
    expect(offer?.sourceTitle).toBe('Dolo 650 Tablet 15 Tablet(s) in Strip');
    expect(offer?.pricePaise).toBe(3300);
    expect(offer?.mrpPaise).toBe(3661);
    expect(offer?.discountPercent).toBe(9.87);
    expect(offer?.manufacturerName).toBe('Micro Labs Ltd');
    expect(offer?.availability).toBe('in_stock');
  });

  it('tryPharmEasySSR parses PharmEasy HTML fixture correctly', async () => {
    const fixturePath = path.join(process.cwd(), 'apps', 'worker', 'tests', 'fixtures', 'ssr', 'pharmeasy-dolo-650.html');
    const html = fs.readFileSync(fixturePath, 'utf8');

    vi.spyOn(ssrFetchModule, 'ssrFetch').mockResolvedValue(html);

    const offer = await tryPharmEasySSR('https://pharmeasy.in/online-medicine-order/dolo-650mg-strip-of-15-tablets-44140');

    expect(offer).not.toBeNull();
    expect(offer?.retailer).toBe('pharmeasy');
    expect(offer?.sourceTitle).toBe('Dolo 650mg Strip Of 15 Tablets');
    expect(offer?.pricePaise).toBe(3356);
    expect(offer?.mrpPaise).toBe(3661);
    expect(offer?.discountPercent).toBe(8.33);
    expect(offer?.manufacturerName).toBe('Micro Labs Ltd');
    expect(offer?.availability).toBe('in_stock');
  });

  it('tryNetmedsSSR parses Netmeds HTML search fixture correctly', async () => {
    const fixturePath = path.join(process.cwd(), 'apps', 'worker', 'tests', 'fixtures', 'ssr', 'netmeds-search-dolo.html');
    const html = fs.readFileSync(fixturePath, 'utf8');

    vi.spyOn(ssrFetchModule, 'ssrFetch').mockResolvedValue(html);

    const offer = await tryNetmedsSSR('dolo 650');

    expect(offer).not.toBeNull();
    expect(offer?.retailer).toBe('netmeds');
    expect(offer?.sourceTitle).toBe("Dolo 650mg Tablet 15'S");
    expect(offer?.sourceUrl).toBe('https://www.netmeds.com/prescriptions/dolo-650mg-tablet-15-s-14faqq');
    expect(offer?.pricePaise).toBe(3300);
    expect(offer?.mrpPaise).toBe(3661);
    expect(offer?.discountPercent).toBe(9.87);
    expect(offer?.manufacturerName).toBe('Micro Labs Ltd');
    expect(offer?.availability).toBe('in_stock');
    expect(offer?.matchStatus).toBe('candidate');
  });
});
