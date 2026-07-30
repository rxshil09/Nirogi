# Nirogi: Add Fetch-First Collection Tier — Implementation Brief

## Context

Nirogi currently collects offers from 1mg, Netmeds, and PharmEasy exclusively via
Playwright (full browser render + DOM selectors). We've confirmed via manual
investigation that all three sites embed structured product/price JSON directly in
their server-rendered HTML:

- **1mg**: `window.__INITIAL_STATE__ = {...}` inline script, before any hydration.
  Path to price: `drugPageReducer.dynamicData.priceBox`.
- **PharmEasy**: standard Next.js `<script id="__NEXT_DATA__" type="application/json">`.
  Path to product: `props.pageProps.productDetails`.
- **Netmeds**: `window.__INITIAL_STATE__ = {...}` inline script. Confirmed reachable at
  `productListingPage.productlists.items[]` on **search/listing pages** (not the
  product detail page) — each item includes `price.effective`, `price.marked`,
  `discount`, `sellable`, `slug`, `url`, `item_code`, `uid`.

This means a plain HTTP `fetch()` + JSON extraction can replace full Playwright
rendering for the common case, with Playwright retained as the reliability fallback.
This is a meaningful architectural change — implement it carefully, not as a bolt-on.

## Goal

Add a fetch-first collection tier ahead of the existing Playwright-based DOM scraping,
without discarding the existing DOM adapters. The existing adapters become the
reliability floor, not dead code.

## Required tier order (do not reorder)

```
Tier 1 — SSR fetch (new)
  fetch(knownCanonicalUrl) → extract embedded JSON → validate → map to domain type
  ↓ on failure (404, extraction throws, shape validation fails, timeout)

Tier 2 — Discovery + retry (existing SerpAPI, reused)
  SerpAPI → resolve current product URL → retry Tier 1 with the new URL
  ↓ on failure (SerpAPI error/quota, no results, Tier 1 retry still fails)

Tier 3 — Playwright DOM scrape (existing adapters, unchanged)
  Full browser render + CSS selectors, exactly as implemented today
```

Each tier's failure must fall through cleanly to the next, and the attempt's
terminal status must still map onto the existing `scrape_attempts` status enum
(`succeeded`, `no_match`, `rate_limited`, `timed_out`, `failed`) — do not introduce a
parallel/competing status model for the new tier.

## Required: one shared JSON-extraction utility, not three

Do not write three separate ad-hoc string-slicing extractors. Implement one shared,
tested utility in `packages/domain/src/extract-embedded-json.ts`:

```ts
function extractEmbeddedJSON(html: string, marker: string): unknown
```

It must use a **balanced-brace parser** (tracking `{`/`}` depth, with proper handling
of `"` string boundaries and `\` escapes) to find the JSON object's true end —
**not** `indexOf("window.__", start)` or any other adjacent-marker string search.
The adjacent-marker approach is fragile: if any string value inside the JSON happens
to contain a substring resembling the next marker, it silently truncates and
`JSON.parse` throws or — worse — succeeds on invalid/truncated data. The balanced-brace
approach is already proven working (it's what worked for Netmeds during manual
investigation) — reuse that exact logic for all three sites, including 1mg, even
though 1mg's naive `indexOf` approach happened to work during manual testing. It
should not be trusted long-term.

For PharmEasy, `<script id="__NEXT_DATA__" type="application/json">...</script>`
extraction via a regex bounded by `</script>` is fine as-is — script tag content
cannot contain a literal `</script>`, so this boundary is structurally safe. No need
to route this one through the balanced-brace parser.

## Per-source implementation notes

### 1mg
- Fetch target: existing canonical product URL from `retailer_listings.canonical_url`
  if present; otherwise fall through to Tier 2 discovery.
- Extract via shared `extractEmbeddedJSON(html, "window.__INITIAL_STATE__ =")`.
- Map from `drugPageReducer.dynamicData.priceBox` and
  `drugPageReducer.staticData.sku` (manufacturer, pack size).
- **Do not yet assume pincode-awareness works via fetch.** This is unverified —
  see "Explicitly deferred" below. Implement Tier 1 as pincode-agnostic for now.

### PharmEasy
- Extract via `<script id="__NEXT_DATA__">` regex, then `JSON.parse`.
- Map from `props.pageProps.productDetails`.
- Confirm at implementation time where price/MRP live in this object (not yet
  located in our manual investigation — likely a sibling key to `productDetails`,
  possibly `product_variants` or `bulk_price`). Add this to the Zod schema once found.
- Same pincode caveat as 1mg — treat Tier 1 output as pincode-agnostic for now.

### Netmeds
- **Different shape from the other two**: the confirmed working extraction point is
  a **search/listing results page**, not a single product detail page. Tier 1 for
  Netmeds should fetch Netmeds' search results URL for the query, extract
  `productListingPage.productlists.items[]`, and apply the existing title/variant
  matching logic (same normalization Nirogi already uses) to select the correct item
  from the array — this replaces SerpAPI's role for Netmeds specifically, since
  Netmeds' own search ranking substitutes for it. **Do not drop SerpAPI as Tier 2
  for Netmeds** in case the listing page ever fails to SSR the array (same
  `"loading": true` skeleton state we saw on the detail page).
- Before trusting `sellable: true` as authoritative availability: cross-check
  against `is_active: false` seen adjacent to it in the sample object. Do not map
  `sellable` directly to `availability: in_stock` until this is understood — flag as
  a TODO with a comment in code and default to `unknown` availability until resolved,
  rather than guessing.

## Required: header consistency across all Tier 1 fetches

Every Tier 1 fetch must set, at minimum:
- A realistic browser `User-Agent` (not Node's default fetch UA)
- `Accept-Language: en-IN`

Apply this via a single shared fetch wrapper, not per-adapter duplication.

## Explicitly deferred — do not attempt in this change

**Pincode-awareness for Tier 1 fetch adapters is out of scope for this change.**
Whether SSR price/availability differs by pincode (via cookie or query param) has
not yet been tested. Do not guess at cookie names or query parameters to "add"
pincode support to Tier 1. Ship Tier 1 as pincode-agnostic (national/default price
only), and mark pincode-aware Tier 1 support as a follow-up. Pincode-aware pricing
continues to come from the existing Playwright Tier 3 path in the meantime, per the
current architecture.

## Data model / architecture changes required

- Add a new `retailers.integration_mode` value: `ssr_fetch` — distinct from
  `browser_collection`. Do not reuse `approved_api`; this is an unofficial but more
  stable data source than DOM scraping, not an official feed.
- Update `ARCHITECTURE.md` in the same change: architectural decisions table,
  scraper/collector architecture section (adapter contract description, tier
  diagram), and source policy section (note that `ssr_fetch` still respects rate
  limits and concurrency caps — it is not exempt from the source policy just because
  it's not a browser).
- Adapter output for all three tiers must still pass through the existing Zod
  validation boundary before entering the domain layer — the domain layer must not
  need to know or care which tier produced a given observation.

## Testing requirements

- Add fixtures for Tier 1: raw HTML samples containing embedded JSON (sanitized,
  same pattern as existing DOM fixtures) for at least one product per source.
- Unit test `extractEmbeddedJSON` directly with: a normal case, a case with escaped
  quotes inside string values, and a case with nested braces in string values, to
  confirm the balanced-brace parser handles all three correctly.
- Do not remove or weaken existing Tier 3 (Playwright/DOM) tests. They remain the
  fallback path and must keep passing.
- Live-source tests still do not run in PR CI — fixtures only, consistent with
  current policy.

## What NOT to change

- Do not modify the `RetailerAdapter` interface's public shape
  (`search(...)`/`getOffer?(...)`) unless genuinely necessary — internal
  implementation can branch by tier without changing the contract the domain layer
  depends on.
- Do not touch job/attempt status enums.
- Do not remove SerpAPI. It remains Tier 2 discovery for 1mg/PharmEasy and the
  fallback for Netmeds if the listing-page SSR fails.
