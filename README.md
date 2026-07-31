# Nirogi 💊

Nirogi is an India-focused medicine price-comparison platform and portfolio project. Built as a high-performance TypeScript monorepo, Nirogi aggregates medicine pricing and availability from leading Indian online pharmacies (e.g., 1mg, Netmeds, PharmEasy) with variant-level precision, transparent timestamping, and historical price tracking.

> 📘 **Detailed Architecture & Target Specifications**: For complete architectural decision records, domain boundary rules, and project delivery phases, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 📋 Table of Contents

- [Features](#-features)
- [Monorepo Infrastructure](#-monorepo-infrastructure)
- [System Architecture](#-system-architecture)
- [3-Tier Scraper Cascade](#-3-tier-scraper-cascade)
- [Database Schema](#-database-schema)
- [API Routes](#-api-routes)
- [Environment Variables](#-environment-variables)
- [Prerequisites & Installation](#-prerequisites--installation)
- [Development & Verification](#-development--verification)
- [Source Policy & Ethics](#-source-policy--ethics)

---

## ✨ Features

- **India-Focused & INR Native**: Strict Indian currency (paise integer storage) and pincode-aware delivery context.
- **Variant-Aware Matching**: Precise matching by brand, generic composition, strength, dosage form, manufacturer, and pack size.
- **3-Tier Low-Latency Scraping**: Fast SSR `fetch()` extraction (~1-3s) falling back to SerpAPI discovery and Playwright DOM rendering floor.
- **Transparent Observation History**: Every offer stores collected timestamps, retailer source links, and MRP vs. sale pricing.
- **Per-Unit Cost Calculations**: Automatic normalization to per-tablet, per-5ml, or per-gram cost across differing pack sizes.

---

## 🏗️ Monorepo Infrastructure

Nirogi is structured as an `npm` workspace monorepo to maintain strict type safety across all components:

```text
Nirogi/
├── apps/
│   ├── web/            React 18 + Vite + Tailwind CSS frontend application
│   ├── api/            Fastify TypeScript REST API with Zod validation & rate-limiting
│   └── worker/         BullMQ worker & Playwright scraper collection service
├── packages/
│   ├── contracts/      Shared Zod request/response schemas and TypeScript interfaces
│   ├── domain/         Core domain logic: title parsing, variant key hashing, unit price formulas
│   └── config/         Type-safe environment variable parsing
├── prisma/
│   ├── schema.prisma   PostgreSQL Prisma database schema
│   └── migrations/     Version-controlled SQL schema migrations
└── docs/
    └── ARCHITECTURE.md Full architectural specifications and decision records
```

---

## 🏛️ System Architecture

```text
Browser (React / Vite SPA)
       │
       ▼
Nirogi API (Fastify + Zod) ────────► Redis (Rate limiting, locks, BullMQ queue)
       │
       ▼
PostgreSQL (Catalogue, Listings, Observations, Job logs)
       ▲
       │
Nirogi Worker (3-Tier Collection Pipeline)
   ├── Tier 1: SSR fetch() + Balanced-Brace JSON extraction (~1-3s)
   ├── Tier 2: SerpAPI URL Discovery Retry
   └── Tier 3: Playwright Browser DOM Scrape (Fallback Floor)
       │
       ▼
Retailer Sources (1mg, Netmeds, PharmEasy)
```

For more details on key architectural decisions (paise storage, ReDoS protection, deduplication locks), read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## ⚡ 3-Tier Scraper Cascade

Each retailer adapter executes a multi-tiered strategy to maximize speed while maintaining operational reliability:

| Tier | Technique | Average Latency | Description |
|---|---|---|---|
| **Tier 1 — SSR HTTP Fetch** | `fetch()` + `extractEmbeddedJSON` | `~1-3s` | Fetches server-rendered HTML and extracts inline JSON payload (`window.__INITIAL_STATE__` or `<script id="__NEXT_DATA__">`). |
| **Tier 2 — Discovery Retry** | SerpAPI Search | `~2-4s` | Resolves canonical product URL when unlisted, then retries Tier 1. |
| **Tier 3 — Playwright DOM Scrape** | Full Browser Execution | `~10-20s` | Fallback floor using Playwright with CSS selectors for Javascript-rendered or bot-protected pages. |

> 🛠️ For detailed design notes on Tier 1 SSR extraction, see [Tier 1 (Scraping SSR)/nirogi-fetch-tier-implementation-brief.md](Tier%201%20(Scraping%20SSR)/nirogi-fetch-tier-implementation-brief.md).

---

## 🗄️ Database Schema

Nirogi uses PostgreSQL managed via Prisma ORM. Key tables include:

- `medicine_products`: Core clinical medicine identity (display name, brand, generic name, composition, prescription status).
- `product_variants`: Exact comparable commercial package (strength, dosage form, pack size, manufacturer, normalized key).
- `retailers`: Registered data sources (1mg, Netmeds, PharmEasy) and integration status.
- `retailer_listings`: Retailer SKU and canonical product URL mapped to a product variant.
- `price_observations`: Immutable append-only log of collected prices (`price_paise`, `mrp_paise`, availability, location/pincode, collected timestamp, tier used).
- `search_jobs` & `scrape_attempts`: Asynchronous job queue status and per-source collection attempt logs.

---

## 📡 API Routes

All REST endpoints are versioned under `/v1` and documented interactively via OpenAPI 3.0 at `/docs`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/docs` | Interactive Swagger UI (OpenAPI 3.0 specification & live testing) |
| `GET` | `/v1/health` | Consolidated system health & database/Redis ping latency check |
| `GET` | `/v1/health/liveness` (`/v1/live`) | Container liveness probe (HTTP 200 process check) |
| `GET` | `/v1/health/readiness` (`/v1/ready`) | Container readiness probe (probes active Postgres & Redis sockets) |
| `GET` | `/v1/metrics/scrapers` | Scraper metrics & BullMQ queue health (success rates %, tier breakdown, latencies) |
| `GET` | `/v1/catalog/suggestions?q=...` | DB-only autocomplete search suggestions (fast, zero scraping) |
| `POST` | `/v1/searches` | Submit search query & pincode (returns cached results or enqueues worker job) |
| `GET` | `/v1/searches/:searchJobId` | Poll background search job status and retrieved partial/full offers |
| `GET` | `/v1/products/:productVariantId/offers` | Fetch current active offers for a specific product variant |
| `GET` | `/v1/products/:productVariantId/price-history` | Historical price observation time-series data |

> 🏥 **Worker Process Health Check**: The background worker process (`apps/worker`) runs a lightweight HTTP health server on port `4001` (or `$HEALTH_PORT`), exposing `GET /health` for container orchestration probes.

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` in the root directory:

```ini
# API Configuration
API_PORT=4000
WEB_ORIGIN=http://localhost:5173

# Database Connection (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nirogi?sslmode=require

# Queue & Caching (Redis)
REDIS_URL=redis://localhost:6379

# Scraper Settings
SERPAPI_API_KEY=your_serpapi_key_here
SCRAPER_HEADLESS=true
```

| Variable | Description | Required |
|---|---|---|
| `API_PORT` | Port for the Fastify server (default `4000`) | Optional |
| `WEB_ORIGIN` | Allowed CORS origin for the frontend | Required |
| `DATABASE_URL` | PostgreSQL connection string | Required for Phase 1+ |
| `REDIS_URL` | Redis connection URL for BullMQ job queue & rate-limiting | Optional (CLI runs without it) |
| `SERPAPI_API_KEY` | SerpAPI key for Tier 2 product URL discovery | Optional |
| `SCRAPER_HEADLESS` | Whether Playwright runs in headless mode (`true`/`false`) | Optional |

---

## ⚙️ Prerequisites & Installation

### 1. Prerequisites

- **Node.js**: `v22.0.0` or higher
- **npm**: `v10.0.0` or higher
- **PostgreSQL**: `v14+` (required for API search & persistence)
- **Redis**: `v6+` (optional in early dev, required for async job queue)

### 2. Installation Steps

```powershell
# 1. Clone the repository
git clone https://github.com/rxshil09/Nirogi.git
cd Nirogi

# 2. Install workspace dependencies
npm install

# 3. Create environment configuration
Copy-Item .env.example .env

# 4. Install Playwright browser dependencies (for Tier 3 scraper worker)
npx playwright install chromium
```

---

## 🚀 Development & Verification

### Running Local Development Servers

```powershell
# Start Web Frontend (React + Vite) on http://localhost:5173
npm run dev:web

# Start API Server (Fastify) on http://localhost:4000
npm run dev:api

# Start Worker Service (BullMQ)
npm run dev:worker
```

### Running Scraper via CLI

You can execute the scraper standalone directly from the terminal:

```powershell
npm run scrape -- --source one-mg --query "Dolo 650 tablet"
```

### Database & Testing Commands

```powershell
# Generate Prisma Client
npm run db:generate

# Run Database Migrations
npm run db:migrate

# Seed Database
npm run db:seed

# Run Unit & Integration Tests (Vitest)
npm run test

# Typecheck All Workspaces
npm run typecheck
```

---

## 📜 Source Policy & Ethics

Nirogi is built as an ethical portfolio project. The scraper pipeline respects source terms, enforces conservative rate limits, never bypasses CAPTCHAs or paywalls, and respects `robots.txt` and source server load limits.

---

*For detailed architectural specifications and design decisions, review [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).*
