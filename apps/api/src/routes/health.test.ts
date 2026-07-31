import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('API System Endpoints (Health, Docs, Metrics)', () => {
  it('GET /v1/health/liveness returns HTTP 200 ok', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/health/liveness',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('nirogi-api');
    await app.close();
  });

  it('GET /v1/health returns overall health status', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/health',
    });

    expect([200, 503]).toContain(response.statusCode);
    const body = response.json();
    expect(body.service).toBe('nirogi-api');
    expect(['ok', 'degraded']).toContain(body.status);
    expect(body.checks).toBeDefined();
    await app.close();
  });

  it('GET /docs returns HTTP 200 or 302 redirect for Swagger UI', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/docs/',
    });

    expect([200, 302]).toContain(response.statusCode);
    await app.close();
  });

  it('GET /v1/metrics/scrapers returns metrics structure', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/metrics/scrapers?windowHours=24',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.service).toBe('nirogi-api');
    expect(body.windowHours).toBe(24);
    expect(body.summary).toBeDefined();
    expect(Array.isArray(body.retailers)).toBe(true);
    expect(Array.isArray(body.tiers)).toBe(true);
    await app.close();
  });
});
