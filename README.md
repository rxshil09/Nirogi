# Nirogi

Nirogi is an India-focused medicine price-comparison portfolio project. It is being rebuilt as a TypeScript workspace with a React web application, Fastify API, Playwright worker, PostgreSQL, and later Redis.

## Current phase

Phase 0 is complete when this TypeScript-only foundation is installed and the web/API/worker type checks pass. The PostgreSQL connection string and Redis are intentionally not required yet.

## Prerequisites

- Node.js 22+
- npm 10+
- PostgreSQL connection string when Phase 1 begins

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev:web
```

Run the API separately with `npm run dev:api`. A database-backed search flow starts in Phase 1 after `DATABASE_URL` is supplied.

## Scraper worker

The worker is TypeScript/Playwright only. After `npm install`, install the required browser once:

```powershell
npx playwright install chromium
```

Example command:

```powershell
npm run scrape -- --source one-mg --query "Dolo 650 tablet"
```

Use source adapters respectfully. Nirogi does not bypass access controls, CAPTCHA, login barriers, or rate limits.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the target design and delivery phases.
