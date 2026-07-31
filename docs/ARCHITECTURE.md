# Nirogi Architecture

## Status and intent

Nirogi is being rebuilt as an India-focused medicine price-comparison portfolio project. The existing BoltRx, PrescribeWise, US insurance, USD, ZIP-code, GoodRx, Stripe, and legacy MongoDB code are not part of the target product and should be removed rather than migrated feature-by-feature.

The rebuild has one initial objective:

> A user searches for a medicine, Nirogi collects offers from a source, stores normalized results in PostgreSQL, and displays transparent, timestamped results in the web application.

Everything else is deliberately deferred: payments, subscriptions, favorites, alerts, admin, email, OTP, OAuth, prescription uploads, insurance, and user accounts. Those features will be designed only after the search and data pipeline is dependable.

This document is the target architecture. It is not a claim that the current code implements it.

## Product scope

### In scope for the first release

- India-only experience and INR pricing.
- Search for branded or generic medicines.
- Exact variant-aware comparison: name, strength, form, manufacturer where available, and pack size.
- Pincode-aware offers where a source exposes location-dependent price or availability.
- One source adapter first, then more adapters one at a time.
- Visible source attribution, direct source link, price/MRP, availability when known, and `last checked` timestamp.
- Historical observations so price freshness and changes can be shown later.

### Explicitly out of scope initially

- Selling medicine, fulfilling orders, handling prescriptions, or medical advice.
- Automatic recommendation of substitutes or therapeutic alternatives.
- Payments, subscriptions, carts, wallets, or Razorpay integration.
- Authentication and profile features beyond what is genuinely needed later.
- Admin dashboards, promotional claims, insurance prices, or pharmacy-distance features.

Nirogi must never represent an uncertain match as the same medicine. A similar name or ingredient is not sufficient: strength, formulation, and pack size matter.

## Architectural decisions

| Concern | Decision | Reason |
|---|---|---|
| Product region | India only | Removes contradictory US data, language, price, and pharmacy assumptions. |
| Language | TypeScript throughout | One type system across frontend, API, workers, tests, and contracts. |
| Frontend | React + Vite + TypeScript | Retains the useful existing frontend direction while adding typed API contracts. |
| API | Node.js + TypeScript + Fastify | Typed request schemas, good validation, and a clean replacement for the current route layer. |
| Validation | Zod | Shared runtime validation for API and worker data. |
| Database | PostgreSQL | Strong constraints and relationships for products, retailer listings, locations, and immutable price history. |
| Database access | Prisma with migrations | Typed database access and repeatable schema migrations. |
| Queue/cache | Redis + BullMQ | Durable-ish job orchestration, deduplication locks, caching, retries, and worker visibility. |
| Collection worker | Node.js + TypeScript + Playwright | Eliminates Python, virtual environments, Windows activation scripts, and shell command interpolation. |
| Deployment unit | Modular monolith: API process + worker process | Simple to build and deploy, while keeping slow collection work away from web requests. |
| Money | Integer paise + `INR` | Avoids floating-point errors. |
| Source integration | Adapter interface | An approved feed/API can replace a browser collector without changing product storage. |
| Rate limiting | `@fastify/rate-limit` backed by Redis | Prevents abuse of the search endpoint and runaway Playwright usage. IP-based, 5 requests/min on `POST /v1/searches`. |
| Input validation | Zod `.max(200)` constraints on all user inputs | Eliminates ReDoS attack surface; `query` capped at 200 characters. |
| Per-unit price | Computed in API response layer from stored paise + pack quantity | No schema column needed; avoids misleading pack-size comparisons. |
| Deduplication | Redis lock on cache key before job creation | Prevents parallel Playwright runs for the same query from concurrent requests. |
| Manufacturer normalization | Canonical lookup table applied before variant key hashing | Inconsistent retailer strings (`"Cipla"` vs `"Cipla Ltd."`) must not create duplicate variants; normalise before keying, not by dropping the field. |
| Playwright resource cleanup | `try/finally` closes browser context on every adapter exit | Prevents context accumulation that silently OOMs the worker process over days of uptime. |
| SerpAPI URL reuse | Use stored `canonical_url` from `retailer_listings` on repeat scrapes; fall back to SerpAPI only on 404 | Eliminates an external round-trip for known products — the single biggest latency win available. |
| 3-Tier SSR Fetch Collection | Tier 1: SSR `fetch()` + balanced-brace JSON extraction (`~1-3s`) → Tier 2: SerpAPI discovery retry → Tier 3: Playwright DOM scrape | Reduces scrape times from 20s+ to 1-3s per adapter for cache-warm searches without sacrificing Playwright reliability fallback. |
| Health Probes & Swagger Specs | `/v1/health/liveness` (liveness probe), `/v1/health` (DB & Redis socket latency probe), `/docs` (OpenAPI UI) | Provides full-stack container health visibility and interactive API documentation. |
| Scraper Telemetry & Metrics UI | `GET /v1/metrics/scrapers` + `/metrics` SPA page with Recharts charts | Real-time observability into 3-tier cascade breakdown, retailer success rates, BullMQ queue status, and recent failure logs with search query context. |
| Cache Hit Atomic Telemetry | Redis atomic counters (`metrics:total_searches`, `metrics:cache_hits`) | Tracks cache hit rate percentages accurately without creating empty database rows or corrupting search offer payloads. |
| Database Migration Tracking | Version-controlled `.sql` migrations in `prisma/migrations/` | Enforces version-controlled schema evolution (`npx prisma migrate dev`), baselined via `20260731000000_init`. |

Fastify may be replaced by Express if there is a strong team preference, but the rest of the boundary and data design should remain unchanged.

## High-level design

```text
Browser (React/Vite)
        |
        v
Nirogi API (Fastify, TypeScript)
        |                         \
        |                          \--> Redis: cache, locks, BullMQ jobs
        v
PostgreSQL: catalogue, listings, offers, price history, jobs
                                      |
                                      v
                         Nirogi Worker (3-Tier Collection)
                          ├── Tier 1: SSR fetch() + JSON extraction (~1-3s)
                          ├── Tier 2: SerpAPI Discovery retry
                          └── Tier 3: Playwright DOM Scrape (fallback floor)
                                      |
                                      v
                         Source adapter / approved API or feed
```

The API never runs Playwright inside a user request. It creates or reuses a job and returns a cached result, a job identifier, or partial results. The worker does the slow work, writes validated observations to PostgreSQL, and updates job status.

## Repository layout

```text
apps/
  web/                         React/Vite TypeScript application
  api/                         Fastify API
  worker/                      BullMQ workers and Playwright adapters
packages/
  contracts/                   Zod schemas and shared TypeScript types
  domain/                      Normalisation, matching, money, and query utilities
  config/                      Typed environment parsing
prisma/
  schema.prisma                PostgreSQL schema
  migrations/                  Generated, reviewed migrations
infra/
  compose/                     Local Docker Compose files
docs/
  decisions/                   Architecture decision records
tests/
  fixtures/                    Sanitised source response fixtures
```

Start as one repository and one deployment pipeline. Do not split into independent microservices until there is a demonstrated operational need.

## Domain and database model

The main distinction is between a clinical/commercial product identity, a sellable variant, a retailer's listing, and an observed offer.

```text
MedicineProduct 1---* ProductVariant 1---* RetailerListing 1---* PriceObservation
                                      \
                                       *---1 Manufacturer (optional)
```

### Core tables

#### `medicine_products`

Represents the medicine identity independent of a particular pack or retailer listing.

| Field | Notes |
|---|---|
| `id` | UUID/ULID primary key |
| `display_name` | Canonical name shown in the product catalogue |
| `brand_name` | Nullable; useful for branded medicines |
| `generic_name` | Nullable; do not assume it implies substitutability |
| `composition` | Structured ingredients, not an uncontrolled text blob |
| `prescription_status` | `unknown`, `otc`, `prescription`, `restricted` |
| `search_aliases` | Normalized aliases used only for candidate retrieval |
| `created_at`, `updated_at` | Audit timestamps |

#### `product_variants`

Represents an exact comparable commercial variant. This is the central comparison entity.

| Field | Notes |
|---|---|
| `id` | UUID/ULID primary key |
| `medicine_product_id` | Foreign key to `medicine_products` |
| `strength_value`, `strength_unit` | For example `500`, `mg` |
| `dosage_form` | `tablet`, `capsule`, `syrup`, `injection`, etc. |
| `pack_quantity`, `pack_unit` | For example `10 tablets`, `100 ml` |
| `manufacturer_name` | Nullable if a source does not expose it |
| `normalised_key` | Deterministic key used to avoid duplicate variants |
| `comparison_status` | `exact` (auto-created variants confirmed by matching logic), `needs_review` (ambiguous — different pack sizes or uncertain title parse) |

Create a unique constraint on a safe normalized identity, such as product + strength + form + pack + manufacturer where those fields are available. Do not use only a medicine name.

#### `retailers`

Defines a source.

| Field | Notes |
|---|---|
| `id` | Primary key |
| `slug` | `one-mg`, `netmeds`, etc. |
| `display_name` | User-facing source name |
| `integration_mode` | `approved_api`, `approved_feed`, `manual_fixture`, `browser_collection` |
| `is_active` | Allows a source to be disabled safely |
| `terms_reviewed_at` | Operational record, not legal approval |

#### `retailer_listings`

Maps a retailer's product page/SKU to one Nirogi product variant.

| Field | Notes |
|---|---|
| `id` | Primary key |
| `retailer_id` | Foreign key |
| `retailer_product_id` | Retailer SKU/identifier when present |
| `canonical_url` | Source URL, normalized without tracking parameters |
| `source_title` | Raw retailer title |
| `product_variant_id` | Nullable until mapping is reviewed |
| `match_confidence` | Numeric score plus matching method |
| `match_status` | `exact`, `candidate`, `needs_review`, `rejected` |
| `last_verified_at` | Last successful source check |

Unique constraints should include retailer + retailer product ID, and retailer + canonical URL when no source product ID exists.

#### `price_observations`

An append-only record of what Nirogi observed. Never overwrite history.

| Field | Notes |
|---|---|
| `id` | Primary key |
| `retailer_listing_id` | Foreign key |
| `location_key` | Pincode or a non-sensitive delivery region key |
| `price_paise` | Current displayed price in paise |
| `mrp_paise` | Nullable MRP in paise |
| `currency` | Always `INR` in this product scope |
| `availability` | `in_stock`, `out_of_stock`, `unknown` |
| `delivery_fee_paise` | Nullable; only when clearly known |
| `delivery_eta` | Nullable human-readable delivery estimate from source, e.g. `"Delivery by tomorrow"` |
| `source_observed_at` | Time declared by source if provided |
| `collected_at` | Time Nirogi collected it — shown to user as "Checked at [time]" for transparency |
| `scrape_attempt_id` | Traceability to the collection attempt |
| `raw_payload_hash` | Integrity/debug reference, not a reason to retain full pages forever |

Use a PostgreSQL view or a maintained `current_offers` table for the latest valid observation per listing and location. The UI reads current offers; charts and audits read observations.

#### Per-unit price calculation

Per-unit price is computed in the API response layer from stored `price_paise` and `pack_quantity`/`pack_unit`. No dedicated column is stored. The formula varies by dosage form:

| Dosage form | Display unit | Formula |
|---|---|---|
| Tablet, Capsule, Patch, Sachet, Powder | price per unit | price ÷ count |
| Syrup, Suspension, Oral liquid | price per 5 ml | (price ÷ total_ml) × 5 |
| Cream, Gel, Ointment | price per gram | price ÷ total_grams |
| Drops, Eye/Ear/Nasal drops, Liquid by volume | price per ml | price ÷ total_ml |
| Injection, Vial, Ampoule | price per ml | price ÷ total_ml |
| Inhaler, Rotacap | price per dose | price ÷ number_of_doses |

If pack quantity cannot be parsed, per-unit price is omitted rather than shown as zero or misleading.

#### `search_jobs` and `scrape_attempts`

`search_jobs` represents the user/system request. `scrape_attempts` represent each source's execution.

Job statuses:

```text
queued -> running -> partial | completed | failed | cancelled
```

Attempt statuses:

```text
queued -> running -> succeeded | no_match | rate_limited | timed_out | failed
```

Store error codes and concise sanitized messages. Do not store browser cookies, credentials, or raw user data in job logs.

### Data rules

- Store all amounts as integers in paise.
- Store timestamps in UTC.
- Include pincode/location context in price and availability observations.
- Store source title and URL for traceability.
- Keep raw HTML/screenshots only when justified, encrypted, short-lived, and permitted by source terms. Prefer parsed fields and a hash.
- Do not store prescriptions, health records, or retailer login sessions in the first release.
- Never use a fuzzy text match alone as an exact product match.

## Scraper/collector architecture

### 3-Tier Collection Cascade

Each retailer adapter implements a 3-tier collection cascade to minimize latency while guaranteeing reliability:

1. **Tier 1 — SSR HTTP Fetch (`~1-3s`)**: Performs a fast `fetch()` with browser-like headers (`User-Agent`, `Accept-Language: en-IN`), extracts server-embedded state JSON (`window.__INITIAL_STATE__` for 1mg/Netmeds via balanced-brace parser `extractEmbeddedJSON`, or `<script id="__NEXT_DATA__">` for PharmEasy), validates the schema with Zod, and maps to `SourceOffer`. Tier 1 is pincode-agnostic and returns national default pricing.
2. **Tier 2 — SerpAPI Discovery Retry**: If Tier 1 fails or no canonical URL was found in DB, SerpAPI resolves the product URL, and Tier 1 is retried with the newly discovered URL.
3. **Tier 3 — Playwright DOM Scrape (Fallback Floor)**: If Tier 1 fails (due to bot detection, missing SSR data, or schema mismatch), the adapter falls through to full Playwright browser rendering with CSS selectors. Tier 3 is pincode-aware and sets localized location cookies/inputs.

All adapter output is validated with a Zod schema (`SourceOfferSchema`) before it enters the domain layer. The domain layer then:

1. normalizes titles, units, forms, and prices;
2. finds or creates the retailer listing;
3. proposes an exact product-variant match;
4. stores an immutable observation;
5. updates the current-offer projection;
6. records a source attempt outcome.

The worker must use `spawn` argument arrays if it ever invokes another process. It must never concatenate user input into a shell command.

### Source policy

This is a portfolio project, but source terms and technical boundaries still matter. Do not bypass CAPTCHA, login controls, robots, rate limits, or access restrictions. Do not use browser stealth/evasion techniques. Prefer an approved API/feed where available.

If a real source cannot be used permissibly, keep the adapter but drive it from recorded, sanitized fixture data. That still demonstrates architecture, parsing, normalization, job orchestration, storage, testing, and frontend behavior honestly.

### Worker behaviour

For each job, the worker:

1. claims one deduplicated queue job;
2. validates query and pincode;
3. invokes each eligible adapter under its concurrency and time limits;
4. saves successful source outcomes independently, so partial results are useful;
5. retries transient failures with capped exponential backoff;
6. stops calling a repeatedly failing source through a circuit breaker;
7. marks the overall job partial, complete, or failed.

Set per-source concurrency to a low value initially, for example one or two workers per retailer. It is a data-quality and operational-control measure, not a technique to evade a source's restrictions.

## Search and caching flow

Do not collect data on every keypress.

### Autocomplete

- The browser debounces typing by roughly 300 ms.
- It calls only Nirogi's internal catalogue endpoint.
- It never invokes Playwright or a retailer source.

### Submitted search

```text
User submits query + optional pincode
        |
        v
API normalizes request and checks current offers
        |
        +--> fresh offer: return immediately
        |
        +--> stale offer: return it with last-checked time; enqueue refresh
        |
        +--> no offer: create/reuse a job; return 202 + job ID
                                      |
                                      v
                              Worker stores partial/full results
                                      |
                                      v
                         Browser polls or receives SSE job updates
```

The deduplication key should be based on normalized query or selected variant, pincode/location, and eligible source set. It prevents 100 users asking for the same medicine from triggering 100 browser jobs.

### Initial freshness policy

These are starting values to adjust after observing permitted source behaviour and price volatility.

| Situation | Behaviour |
|---|---|
| Search suggestions | Internal database only; never collect live data |
| Fresh offer | Return immediately when collected within 6 hours |
| Stale but usable offer | Return with timestamp and enqueue refresh up to 48 hours old |
| Cold query | Queue one job after explicit search submission |
| Hot products / later favorites | Refresh every 6–12 hours if the source agreement permits it |
| Long-tail products | On-demand only, with a 12–24 hour per-key cooldown |
| Source failure | Bounded retry, then expose source as temporarily unavailable |

Never call a source in the request-response path merely because someone typed a character.

## Public API for the first milestone

All routes are versioned and validated.

```text
GET  /v1/health
GET  /v1/catalog/suggestions?q=paracetamol
POST /v1/searches
GET  /v1/searches/:searchJobId
GET  /v1/products/:productVariantId/offers?pincode=400001
GET  /v1/products/:productVariantId/price-history?days=30
```

`POST /v1/searches` request:

```json
{
  "query": "Dolo 650 tablet",
  "pincode": "400001"
}
```

Possible response behaviour:

```json
{
  "status": "completed",
  "cacheStatus": "fresh",
  "productVariantId": "...",
  "results": [],
  "lastCheckedAt": "2026-07-14T10:00:00Z"
}
```

or:

```json
{
  "status": "queued",
  "searchJobId": "...",
  "pollAfterMs": 1500
}
```

`productVariantId` is included in the completed response so the frontend can immediately fetch the price history chart for the matched variant.

The API response must distinguish `exact`, `candidate`, and `unmatched` results. The browser must not display candidate results as an exact price comparison.

`GET /v1/catalog/suggestions?q=paracetamol` queries `MedicineProduct.displayName` and `searchAliases` only — never triggers scraping. Returns known catalogue variants instantly for autocomplete. Suggestions are limited to medicines that have been searched at least once; cold-start is expected and documented.

`GET /v1/products/:productVariantId/price-history?days=30` returns time-series price observations per retailer for the requested window. Public — no authentication required. If fewer than 5 observations exist, the response includes a `insufficientData: true` flag and the frontend shows "More data will appear as this medicine is searched over time" rather than a misleading flat chart.

## Canonical URL and sharing

Search state is encoded in the URL query string so comparisons are shareable:

```text
/compare?q=dolo+650+tablet
/compare?q=dolo+650+tablet&pin=400001
```

On page load, `ComparePage` reads `q` and `pin` from the URL and auto-submits the search. When the user submits a new search or changes pincode, the URL updates to match. This makes every comparison a permanent, shareable link.

## Frontend first-release experience

1. User enters a medicine name and optional pincode.
2. Autocomplete dropdown shows known Nirogi catalogue variants (debounced 300ms, DB-only).
3. User submits a search or selects a suggestion.
4. URL updates to `/compare?q=...&pin=...` — link is immediately shareable.
5. The page immediately shows cached offers or a clear loading state with real-time skeleton cards.
6. Source cards arrive as jobs complete, each showing: pack/form, price, MRP, discount, per-unit price, manufacturer name, source link, availability, delivery info (if pincode provided), match label, and last checked timestamp.
7. Partial failure is explicit: for example, `Results from 1 source; 2 sources unavailable`.
8. Below the offer cards, a price history chart shows price trends per retailer over the last 30 days. If insufficient data exists, a transparent message is shown.

The first release should not claim real-time data, the lowest possible price, medical equivalence, or nationwide availability.

## Incremental delivery plan

### Phase 0 — repository and safety reset

- Create a Git repository and `.gitignore` before migration work.
- Rotate the exposed source credential and remove all secrets from code.
- Preserve the old project only as an archive/branch if desired; do not keep it in the active application path.
- Remove BoltRx/PrescribeWise names, US sample data, US models, GoodRx, insurance, Stripe, and obsolete routes.
- Create the TypeScript workspace, Docker Compose development environment, `.env.example`, and CI baseline.

Definition of done: a clean India-only TypeScript skeleton starts locally with PostgreSQL and Redis; no old product code is imported.

### Phase 1 — database and one-source vertical slice

- Implement Prisma schema and migrations for the core tables.
- Implement the API, contracts package, queue, and worker.
- Implement one TypeScript adapter using a permitted source or fixtures.
- Persist product variants, listings, observations, jobs, and attempts.
- Implement search submission/status APIs.
- Connect the React comparison page to show real stored results.
- Add unit tests using fixtures and an integration test with Postgres/Redis.

Definition of done: submit one medicine search, store a valid observation, and show a timestamped result card after a page refresh.

### Phase 2 — comparison quality, resilience, and user experience

**Matching and data correctness**
- Add refined variant matching: separate `ProductVariant` rows for different pack sizes; tag auto-created variants `needs_review`; tag confirmed matches `exact`.
- Build a canonical manufacturer lookup table; normalise `manufacturerName` through it before it enters `buildNormalisedVariantKey`. Restore `manufacturerName` to the variant key. This closes the silent false-merge bug where different manufacturers' variants were collapsed into one `exact` row.
- Add a fixture-driven edge-case test table for the title parser covering decimals (`"0.30ml"`), missing units, unusual forms, and multi-number titles. Parser logic is the most recurring failure category and must have explicit coverage before new medicine types are added.

**Resilience and security**
- Add Redis deduplication lock on `POST /v1/searches` cache key at the HTTP request layer (before job enqueue) to prevent parallel jobs for identical concurrent queries.
- Add rate limiting: `@fastify/rate-limit` with Redis backend, 5 requests/minute per IP on `POST /v1/searches`; ~30 per minute on GET routes.
- Add Zod `.max(200)` input length constraint on `query` field in contracts to close ReDoS attack surface.
- Wrap every adapter's Playwright context in a `try/finally` block that calls `context.close()` on both success and error paths. Confirm each job receives its own `browser.newContext()` — pincode session state must not bleed between concurrent jobs.
- Handle SerpAPI 429 and quota-exhaustion errors explicitly: map to `rate_limited` attempt status so the job degrades to `partial` rather than crashing.
- Use stored `retailer_listings.canonical_url` for repeat scrapes instead of re-running SerpAPI discovery; fall back to SerpAPI only when the stored URL returns a 404 or an unrecognisable page.

**API and response quality**
- Compute and expose per-unit price in both `GET /v1/searches/:id` polling response and `GET /v1/products/:id/price-history` by dosage form category (tablet, syrup, cream, drops, injection, inhaler, etc.).
- Add manufacturer name and delivery ETA to offer API response and frontend card display.
- Expose `productVariantId` in `SearchResultResponse` so the frontend can link directly to the price history chart.

**User experience**
- Implement `GET /v1/catalog/suggestions` for DB-backed autocomplete on the frontend (debounced 300 ms, never triggers scraping).
- Implement canonical URL share links: encode `q` and `pin` in the URL; auto-submit on page load.
- Implement `GET /v1/products/:productVariantId/price-history` and public price history chart on the frontend (recharts, dual AreaChart: total pack price + per-unit price).
- Add a second and third source adapter (Netmeds, PharmEasy) — already done; keep adapters stable.
- Add a visible disclaimer on every offer card: *"Always verify with your pharmacist. This is not medical advice."* — domain-appropriate and essential before any public demo.

Definition of done: multiple sources return partial results safely; manufacturer normalization is active and the variant key includes manufacturer; per-unit prices appear in search results; comparisons are shareable via URL; public price history chart renders; deduplication, rate limiting, and SerpAPI error handling are active; all adapter contexts are closed on error paths; medical disclaimer is visible on every offer card.

### Phase 3 — production readiness

**Infrastructure and deployment**
- Add Docker images for web, API, and worker.
- Add CI for formatting, type checking, tests, builds, dependency audit, secret scan, and container scan.
- Add staging and production environments with separate databases/secrets.
- Add structured logs with redaction, error tracking, health/readiness endpoints, metrics, alerts, and backup/restore verification.
- Add restrictive CORS, security headers, and authenticated operational endpoints.
- Add Playwright URL allowlist — worker navigates only to approved retailer domains.
- Add source health dashboard (admin-only internal page).

**Performance and UX**
- Persist Playwright `storageState` per (retailer, pincode) pair after a successful pincode selection. Reload stored state on repeat scrapes of the same retailer+pincode to skip the modal-click flow entirely.
- Add a retry-on-demand action in the frontend: when a source card shows as unavailable, allow the user to trigger a re-scrape for that specific source without waiting out the full cooldown window.
- Add Open Graph meta tags to the share URL flow. Since the app is a Vite SPA, inject at minimum a static OG tag at build time so that `/compare?q=...` links render a recognisable preview when shared on WhatsApp (the primary sharing channel in India).
- Add a SerpAPI budget alert and fallback story: if SerpAPI quota is exhausted, degrade to returning cached listings with a `stale` flag rather than failing the job entirely.

Definition of done: a staging deployment is reproducible, observable, backed up, and safe to demo publicly; share links preview correctly on WhatsApp; repeat scrapes skip pincode modal flows; failed sources are retryable by the user.

### Phase 4 — deferred feature decisions

Only after Phase 3, design one feature at a time:

**Auth and personal features**
- Authentication (OAuth / OTP) — only when genuinely needed for personal features.
- Personal price history — per-user searched medicine history and price trends.
- Price drop alerts — notify authenticated user when price falls below a threshold.
- Favourites — save and return to medicine comparisons.

**Transport upgrade**
- Replace the 750 ms polling loop with SSE (Server-Sent Events) or WebSocket push. The worker knows the instant an observation is written; push it rather than waiting for the next poll tick. Polling is simpler and works behind all proxies, so defer this until the polling lag is actually user-visible at scale.

**Data quality & composition search**
- Implement DPCO / NPPA price ceiling validation as a heuristic data-quality check: if a scraped `price_paise` exceeds the legal MRP ceiling for a scheduled formulation, flag the observation as suspect rather than displaying it. This requires maintaining a reference table of NPPA-controlled medicine ceilings and is worth mentioning explicitly in interviews as a domain-aware quality signal.
- **Composition and Active Salt Search** (`GET /v1/catalog/by-composition?salt=paracetamol`): Allow users to search by active chemical ingredient or salt (e.g. "Paracetamol 650mg", "Ipratropium Bromide"), returning all matched branded and generic medicine variants stored in Nirogi's database for side-by-side price comparison across manufacturers.

**Monetisation (if relevant)**
- Affiliate commission links (Amazon, 1mg affiliate, etc.) and/or paid placement from retailer partnerships — only after the core pipeline is demonstrably reliable.
- Admin moderation tools, notifications, and payments/subscriptions if they still add value at that point.

## Production-readiness checklist

- TypeScript strict mode enabled in every application/package.
- No `any` at API or worker boundaries; Zod validation required at runtime.
- Prisma migrations reviewed and applied through deployment, never `db push` in production.
- PostgreSQL backups with point-in-time recovery and a tested restore process.
- Redis is not the source of truth; PostgreSQL remains authoritative.
- Secrets live in a deployment secret manager, never Git or container images.
- Logs redact pincode, tokens, headers, user identifiers, and search data where not needed.
- Metrics and diagnostics are private, authenticated, or network-restricted.
- Live-source tests are not run in pull-request CI; fixtures are used instead.
- Worker resource/time limits and source concurrency are set explicitly.
- API and worker deployments are independently restartable and observable.
- Every offer exposes its source and last-observed time.

## What not to build yet

Do not carry forward the legacy dashboard, US pharmacy/insurance data, payment code, fake metrics, public admin flow, or incomplete auth services. They add surface area without proving the core product.

The first impressive demo is not a payment flow. It is an honest, typed, testable data pipeline that can show:

```text
query -> queued job -> TypeScript source adapter -> normalized PostgreSQL observation -> frontend comparison card
```

That is the foundation on which every later feature can be added safely.
