import { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { getScraperMetrics, type ScraperMetricsResponse } from '../services/api.js';

const TIER_COLORS: Record<string, string> = {
  TIER_1_SSR: '#10b981', // Emerald green
  TIER_2_SERPAPI: '#3b82f6', // Bright blue
  TIER_3_PLAYWRIGHT: '#f59e0b', // Amber
};

const RETAILER_NAMES: Record<string, string> = {
  'one-mg': 'Tata 1mg',
  '1mg': 'Tata 1mg',
  pharmeasy: 'PharmEasy',
  netmeds: 'Netmeds',
  apollo: 'Apollo Pharmacy',
  flipkart: 'Flipkart Health+',
};

export const MetricsPage = () => {
  const [windowHours, setWindowHours] = useState<number>(0); // Default 0 = All Time
  const [data, setData] = useState<ScraperMetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchMetrics = async () => {
    try {
      setError(null);
      const res = await getScraperMetrics(windowHours);
      setData(res);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchMetrics();
  }, [windowHours]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchMetrics();
    }, 10000); // 10 seconds auto-refresh
    return () => clearInterval(interval);
  }, [autoRefresh, windowHours]);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(' ');
  };

  const isSystemHealthy =
    data?.health.database.status === 'up' &&
    (data?.health.redis.status === 'up' || data?.health.redis.status === 'not_configured');

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16 pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                System Telemetry & Scraper Health
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  isSystemHealthy
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isSystemHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {isSystemHealthy ? 'System Healthy' : 'Degraded State'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Real-time telemetry for BullMQ scraping queues, 3-tier scraper cascade, and database health.
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {[
                { label: 'All Time', val: 0 },
                { label: '1h', val: 1 },
                { label: '6h', val: 6 },
                { label: '24h', val: 24 },
                { label: '7d', val: 168 },
              ].map((item) => (
                <button
                  key={item.val}
                  onClick={() => setWindowHours(item.val)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    windowHours === item.val
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                autoRefresh
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
              {autoRefresh ? 'Auto 10s' : 'Paused'}
            </button>

            <button
              onClick={() => {
                setLoading(true);
                fetchMetrics();
              }}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
            >
              <svg className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-8 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
            ⚠️ {error}
          </div>
        ) : null}

        {/* Top KPI Cards Grid */}
        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Scraper Success Rate */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Scraper Success Rate</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                {data ? `${data.summary.overallSuccessRatePercent}%` : '---'}
              </span>
              <span className="text-xs text-slate-500">
                ({data?.summary.successfulAttempts ?? 0} / {data?.summary.totalAttempts ?? 0})
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, data?.summary.overallSuccessRatePercent ?? 100)}%` }}
              />
            </div>
          </div>

          {/* Card 2: Average Scraping Latency */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Mean Scrape Latency</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                {data && data.summary.overallAvgDurationMs > 0 ? `${data.summary.overallAvgDurationMs} ms` : 'Sub-second'}
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-slate-500">
              Tier 1 SSR Target: &lt;3,000 ms
            </p>
          </div>

          {/* Card 3: BullMQ Queue State */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">BullMQ Worker Queue</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div>
                <span className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {data?.queue?.active ?? 0}
                </span>
                <span className="ml-1 text-xs text-slate-500">Active</span>
              </div>
              <span className="text-slate-300">|</span>
              <div>
                <span className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {data?.queue?.waiting ?? 0}
                </span>
                <span className="ml-1 text-xs text-slate-500">Waiting</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Completed: {data?.queue?.completed ?? 0} • Failed: {data?.queue?.failed ?? 0}
            </p>
          </div>

          {/* Card 4: Search Engine & Cache Hit Rate */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Search Cache Hit Rate</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                {data ? `${data.searchTelemetry.cacheHitRatePercent}%` : '---'}
              </span>
              <span className="text-xs text-slate-500">
                ({data?.searchTelemetry.totalJobs ?? 0} jobs)
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Instant response from 6h cache window
            </p>
          </div>
        </div>

        {/* System Health & Footprint Row */}
        <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Database & Redis Sockets */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Infra Socket Latencies</h2>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${data?.health.database.status === 'up' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className="text-sm font-semibold text-slate-800">Neon PostgreSQL</span>
                </div>
                <span className="text-xs font-bold text-slate-600">
                  {data?.health.database.latencyMs != null && data.health.database.latencyMs >= 0
                    ? `${data.health.database.latencyMs} ms`
                    : 'Down / Timeout'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${data?.health.redis.status === 'up' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="text-sm font-semibold text-slate-800">Railway Redis</span>
                </div>
                <span className="text-xs font-bold text-slate-600">
                  {data?.health.redis.status === 'not_configured'
                    ? 'Not Configured'
                    : data?.health.redis.latencyMs != null && data.health.redis.latencyMs >= 0
                      ? `${data.health.redis.latencyMs} ms`
                      : 'Down'}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
                <span>Fastify Process Uptime:</span>
                <span className="font-semibold text-slate-700">{data ? formatUptime(data.uptimeSeconds) : '---'}</span>
              </div>
            </div>
          </div>

          {/* Database Catalog Footprint */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Database Catalog Footprint</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <span className="text-xs font-medium text-slate-500">Medicine Products</span>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">{data?.catalog.products ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <span className="text-xs font-medium text-slate-500">Product Variants</span>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">{data?.catalog.variants ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <span className="text-xs font-medium text-slate-500">Retailer Listings</span>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">{data?.catalog.listings ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <span className="text-xs font-medium text-slate-500">Price Observations</span>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">{data?.catalog.observations ?? 0}</p>
              </div>
            </div>
          </div>

          {/* Tier Cascade Distribution Chart */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Scraper Tier Distribution</h2>
            <div className="mt-2 h-44 w-full">
              {data?.tiers && data.tiers.some((t) => t.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.tiers.filter((t) => t.count > 0)}
                      dataKey="count"
                      nameKey="tier"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                    >
                      {data.tiers.map((entry) => (
                        <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] || '#64748b'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val} attempts`, name]}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-xs text-slate-400">
                  <span className="font-semibold text-slate-600">Tier 1 SSR Primary</span>
                  <span>(Zero tier fallbacks required)</span>
                </div>
              )}
            </div>
            <div className="flex justify-center gap-4 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Tier 1 (SSR)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Tier 2 (SerpAPI)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Tier 3 (Playwright)
              </span>
            </div>
          </div>
        </div>

        {/* Retailer Performance Section */}
        <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Retailer Scraper Breakdown</h2>
          <p className="text-xs text-slate-500">Per-pharmacy success rate, query attempts, and average extraction latency.</p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.retailers && data.retailers.length > 0 ? (
              data.retailers.map((r) => {
                const name = RETAILER_NAMES[r.retailerSlug] || r.displayName || r.retailerSlug;
                const successRate = r.total > 0 ? r.successRatePercent : 100;

                return (
                  <div key={r.retailerSlug} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition-all hover:bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{name}</span>
                      <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold border border-slate-200 text-slate-700">
                        {r.total} attempts
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-2xl font-extrabold text-slate-900">{successRate}%</span>
                      <span className="text-xs font-semibold text-slate-500">{r.avgDurationMs > 0 ? `${r.avgDurationMs} ms` : 'Sub-second'}</span>
                    </div>

                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          successRate >= 90 ? 'bg-emerald-500' : successRate >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, successRate)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-8 text-center text-xs font-medium text-slate-400">
                No retailer data found
              </div>
            )}
          </div>
        </div>

        {/* Recent Error Diagnostic Console */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recent Scraper Failure Logs</h2>
              <p className="text-xs text-slate-500">Top 5 recent failed scrape attempt diagnostics for troubleshooting.</p>
            </div>
            {lastUpdated ? (
              <span className="text-xs font-medium text-slate-400">Updated {lastUpdated}</span>
            ) : null}
          </div>

          <div className="mt-4 overflow-x-auto">
            {data?.recentFailures && data.recentFailures.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="px-3 py-2.5">Timestamp</th>
                    <th className="px-3 py-2.5">Search Query</th>
                    <th className="px-3 py-2.5">Retailer</th>
                    <th className="px-3 py-2.5">Tier</th>
                    <th className="px-3 py-2.5">Error Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {data.recentFailures.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-500 font-sans font-medium">
                        {new Date(f.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-sans font-semibold text-slate-900">
                        "{f.searchQuery || 'N/A'}"
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-sans font-bold text-slate-900">
                        {RETAILER_NAMES[f.retailerSlug] || f.retailerSlug}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="rounded bg-amber-100 px-2 py-0.5 font-sans text-[10px] font-bold text-amber-800">
                          {f.tier}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-rose-600">{f.errorMessage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex h-24 items-center justify-center rounded-xl bg-slate-50 text-xs font-medium text-slate-500">
                🎉 Zero scraper failures recorded in the selected timeframe!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
