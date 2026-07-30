import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SourceOffer } from '../types/search.js';
import { ApiError, getSearchJob, submitSearch, getSuggestions, getPriceHistory, type SuggestionProduct, type PriceHistoryPoint } from '../services/api.js';
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

const formatMoney = (paise: number | null) =>
  paise === null
    ? 'Price unavailable'
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100);

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const RETAILER_LABELS: Record<string, string> = {
  'one-mg': '1mg',
  netmeds: 'Netmeds',
  pharmeasy: 'PharmEasy',
};

const RETAILER_COLORS: Record<string, string> = {
  'one-mg': '#e2231a',
  netmeds: '#00a99d',
  pharmeasy: '#00a650',
};

const pincodeToCityName = (pin?: string): string | null => {
  if (!pin || pin.length !== 6) return null;
  const prefix = pin.slice(0, 2);
  switch (prefix) {
    case '11': return 'Delhi';
    case '40': return 'Mumbai';
    case '41': return 'Pune';
    case '45': return 'Indore';
    case '50': return 'Hyderabad';
    case '56': return 'Bengaluru';
    case '60': return 'Chennai';
    case '70': return 'Kolkata';
    case '12': return 'Gurgaon';
    case '20': return 'Noida';
    case '38': return 'Ahmedabad';
    default: return null;
  }
};

const OfferCard = ({ offer, pincode }: { offer: SourceOffer; pincode?: string }) => {
  const label = RETAILER_LABELS[offer.retailer] ?? offer.retailer;
  const color = RETAILER_COLORS[offer.retailer] ?? '#6366f1';
  const isNotFound = offer.availability === 'not_found';
  const isSearching = offer.availability === 'searching';

  const getLocalizedUrl = () => {
    if (!offer.sourceUrl) return offer.sourceUrl;
    if (!pincode) return offer.sourceUrl;
    try {
      const u = new URL(offer.sourceUrl);
      u.searchParams.set('pincode', pincode);
      if (offer.retailer === 'one-mg') {
        const city = pincodeToCityName(pincode);
        if (city) u.searchParams.set('city', city);
      }
      return u.toString();
    } catch {
      return offer.sourceUrl;
    }
  };

  const localizedUrl = getLocalizedUrl();

  return (
    <article className={`rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${isNotFound ? 'border-dashed border-border opacity-70' : 'border-border'} ${isSearching ? 'animate-pulse' : ''}`}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: isNotFound ? '#9ca3af' : color }}
            >
              {label}
            </span>
            {offer.tierUsed === 'tier1_ssr' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                ⚡ Tier 1 (SSR)
              </span>
            )}
            {offer.tierUsed === 'tier2_serp' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                🔍 Tier 2 (SerpAPI)
              </span>
            )}
            {offer.tierUsed === 'tier3_playwright' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">
                🌐 Tier 3 (Playwright)
              </span>
            )}
            {offer.fetchTimeMs !== null && (
              <span className="text-xs text-textSecondary">fetched in {formatDuration(offer.fetchTimeMs)}</span>
            )}
            {isSearching && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }}></span>
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: color }}></span>
              </span>
            )}
          </div>

          {isSearching ? (
            <div className="mt-3 space-y-2">
              <div className="h-5 w-48 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse"></div>
            </div>
          ) : isNotFound ? (
            <p className="mt-3 text-base text-textSecondary italic">Not listed on {label}</p>
          ) : (
            <>
              <h3 className="mt-2 text-xl font-semibold text-text">{offer.sourceTitle ?? 'Medicine listing'}</h3>
              {offer.manufacturerName && (
                <div className="mt-1.5 flex flex-wrap gap-2 items-center">
                  <span className="inline-flex items-center rounded bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary uppercase tracking-wider">
                    {offer.manufacturerName}
                  </span>
                  {offer.matchStatus === 'needs_review' && (
                    <span className="inline-flex items-center rounded bg-yellow-100 px-2.5 py-0.5 text-xs font-bold text-yellow-800 uppercase tracking-wider">
                      ⚠️ Variant May Differ
                    </span>
                  )}
                  {offer.availability === 'not_for_sale' && (
                    <span className="inline-flex items-center rounded bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 uppercase tracking-wider">
                      🚫 Not for sale in this area
                    </span>
                  )}
                  {offer.availability === 'out_of_stock' && (
                    <span className="inline-flex items-center rounded bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 uppercase tracking-wider">
                      ⚠️ Out of Stock
                    </span>
                  )}
                </div>
              )}
              {!offer.manufacturerName && (
                <div className="mt-1.5">
                  {offer.availability === 'not_for_sale' && (
                    <span className="inline-flex items-center rounded bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 uppercase tracking-wider">
                      🚫 Not for sale in this area
                    </span>
                  )}
                  {offer.availability === 'out_of_stock' && (
                    <span className="inline-flex items-center rounded bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 uppercase tracking-wider">
                      ⚠️ Out of Stock
                    </span>
                  )}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-textSecondary">
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Match: <span className={offer.matchStatus === 'needs_review' ? 'text-amber-600 font-semibold' : ''}>{offer.matchStatus.replace('_', ' ')}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Checked: {new Date(offer.collectedAt).toLocaleString('en-IN')}
                </span>
              </div>
            </>
          )}
        </div>

        {isSearching ? (
          <div className="text-left sm:text-right mt-2 sm:mt-0 space-y-2">
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse sm:ml-auto"></div>
            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse sm:ml-auto"></div>
          </div>
        ) : !isNotFound && (
          <div className="text-left sm:text-right">
            {offer.pricePaise !== null ? (
              <>
                <p className={`text-3xl font-bold ${offer.availability === 'not_for_sale' ? 'text-gray-400 line-through' : offer.availability === 'out_of_stock' ? 'text-amber-600' : 'text-success'}`}>
                  {formatMoney(offer.pricePaise)}
                </p>
                {offer.pricePerUnit && (
                  <p className="text-xs font-semibold text-textSecondary mt-0.5">{offer.pricePerUnit}</p>
                )}
                {offer.availability === 'not_for_sale' && (
                  <p className="text-xs font-bold text-red-600 mt-1">Item Listed, Not for Sale</p>
                )}
              </>
            ) : (
              <div>
                <p className="text-xl font-semibold text-error">
                  {offer.availability === 'not_for_sale' ? 'Not for sale' : offer.availability === 'out_of_stock' ? 'Out of stock' : 'Price unavailable'}
                </p>
                {offer.availability === 'not_for_sale' && (
                  <p className="text-xs text-textSecondary mt-0.5">Not delivered to selected region</p>
                )}
              </div>
            )}
            {offer.mrpPaise !== null && (
              <p className="mt-1 text-sm text-textSecondary line-through">MRP {formatMoney(offer.mrpPaise)}</p>
            )}
            {offer.discountPercent !== null && offer.discountPercent > 0 && offer.availability !== 'not_for_sale' && (
              <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-success">
                {offer.discountPercent}% off
              </span>
            )}
          </div>
        )}
      </div>

      {!isNotFound && !isSearching && localizedUrl && (
        <div className="mt-5 flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={localizedUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            View on {label} {pincode ? `(pincode ${pincode})` : ''}
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
          <span className="text-xs text-textSecondary italic">
            ⚠️ Always verify details with your pharmacist. This is not medical advice.
          </span>
        </div>
      )}
    </article>
  );
};

export const ComparePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [pincode, setPincode] = useState(searchParams.get('pin') ?? '');
  const [results, setResults] = useState<SourceOffer[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const startTimeRef = useRef<number>(0);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<SuggestionProduct[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  // Price history state
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [dosageForm, setDosageForm] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyInsufficient, setHistoryInsufficient] = useState(false);

  // UI tabs & sharing states
  const [activeTab, setActiveTab] = useState<'offers' | 'history'>('offers');
  const [shareCopied, setShareCopied] = useState(false);
  const latestQueryRef = useRef('');

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error('Error sharing link:', err);
    }
  };

  // Load search from URL search params on mount
  useEffect(() => {
    const qParam = searchParams.get('q');
    const pinParam = searchParams.get('pin');
    if (qParam) {
      setQuery(qParam);
      if (pinParam) {
        setPincode(pinParam);
      }
      executeSearch(qParam, pinParam ?? '');
    }
  }, []);

  const loadHistory = async (variantId: string) => {
    setHistoryLoading(true);
    setHistoryInsufficient(false);
    try {
      const data = await getPriceHistory(variantId);
      setPriceHistory(data.history);
      setDosageForm(data.dosageForm);
      setHistoryInsufficient(data.insufficientData);
    } catch (err) {
      console.error('Error loading price history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const pollForResults = async (searchJobId: string): Promise<boolean> => {
    try {
      const result = await getSearchJob(searchJobId);
      const now = Date.now();

      if (result.results.length > 0) {
        setResults(result.results);
        const elapsed = now - startTimeRef.current;
        setElapsedMs(elapsed);
      }

      if (result.sourceErrors && result.sourceErrors.length > 0) {
        setError(`Errors from some sources: ${result.sourceErrors.join(', ')}`);
      }

      const validOffersCount = result.results.filter((o) => o.sourceTitle !== null && o.availability !== 'searching').length;
      if (result.status === 'completed' || result.status === 'partial' || validOffersCount >= 3) {
        const elapsed = now - startTimeRef.current;
        const finalResults = result.results;

        // Fetch price history if productVariantId is returned
        if (result.productVariantId) {
          loadHistory(result.productVariantId);
        }

        // Console logging
        console.group(`%c🔍 Nirogi Search Complete — "${query}"`, 'color: #6366f1; font-weight: bold; font-size: 14px;');
        console.log(`%c⏱ Total time: ${formatDuration(elapsed)}`, 'color: #10b981; font-weight: bold;');
        console.log(`%c📦 Results: ${finalResults.length} offer(s) found`, 'color: #3b82f6;');
        finalResults.forEach((offer) => {
          const label = RETAILER_LABELS[offer.retailer] ?? offer.retailer;
          console.group(`%c🏪 ${label}`, `color: ${RETAILER_COLORS[offer.retailer] ?? '#6b7280'}; font-weight: bold;`);
          console.log('Collection Tier:', offer.tierUsed ? `${offer.tierUsed.toUpperCase()} (Fast SSR)` : 'tier3_playwright (Playwright DOM Fallback)');
          console.log('Title:', offer.sourceTitle ?? 'N/A');
          console.log('Price:', offer.pricePaise !== null ? formatMoney(offer.pricePaise) : 'Unavailable');
          console.log('MRP:', offer.mrpPaise !== null ? formatMoney(offer.mrpPaise) : 'N/A');
          console.log('Discount:', offer.discountPercent !== null ? `${offer.discountPercent}%` : 'N/A');
          console.log('Match:', offer.matchStatus);
          console.log('Collected at:', new Date(offer.collectedAt).toLocaleString('en-IN'));
          console.log('URL:', offer.sourceUrl);
          console.groupEnd();
        });
        console.groupEnd();

        setNotice(result.status === 'completed' ? 'All results collected.' : 'Results collected (some sources failed).');
        return true;
      } else if (result.status === 'failed') {
        setError('The search job failed to collect results.');
        return true;
      } else if (result.status === 'cancelled') {
        setError('The search job was cancelled.');
        return true;
      } else {
        const elapsed = now - startTimeRef.current;
        setNotice(`Searching… (${formatDuration(elapsed)} elapsed)`);
        return false;
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Error fetching job results.');
      return true;
    }
  };

  const executeSearch = async (targetQuery: string, targetPincode: string) => {
    const trimmedQuery = targetQuery.trim();
    if (trimmedQuery.length < 2) {
      setError('Enter at least two characters for a medicine search.');
      return;
    }
    if (targetPincode && !/^\d{6}$/.test(targetPincode)) {
      setError('Pincode must contain six digits.');
      return;
    }

    // Update URL query parameters for sharing
    const newParams: Record<string, string> = { q: trimmedQuery };
    if (targetPincode) {
      newParams.pin = targetPincode;
    }
    setSearchParams(newParams);

    setActiveTab('offers');
    setLoading(true);
    setError('');
    setNotice('');
    setResults([]);
    setPriceHistory([]);
    setElapsedMs(0);
    startTimeRef.current = Date.now();

    console.log(`%c🔍 Nirogi: Starting search for "${trimmedQuery}"…`, 'color: #6366f1; font-weight: bold;');

    try {
      const job = await submitSearch({ query: trimmedQuery, ...(targetPincode ? { pincode: targetPincode } : {}) });

      if (job.status === 'completed' || job.status === 'partial') {
        startTimeRef.current = Date.now();
        await pollForResults(job.searchJobId);
        return;
      }

      setNotice('Search queued. Scraping pharmacy websites…');

      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max
      let isDone = false;

      // Exponential backoff: fast early polls when pipeline is running (<2s),
      // slower polls for stale/slow jobs to avoid hammering Neon DB.
      const getDelay = (attempt: number) =>
        attempt === 0 ? 600 : attempt === 1 ? 800 : attempt < 5 ? 1000 : 1500;

      while (!isDone && attempts < maxAttempts) {
        await new Promise((resolve) => window.setTimeout(resolve, getDelay(attempts)));
        isDone = await pollForResults(job.searchJobId);
        attempts++;
      }

      if (!isDone) {
        setNotice('Search is taking longer than expected. Please refresh or try again later.');
      }
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.status === 503) {
        setError('The search pipeline is not available. Make sure the worker and database are running.');
      } else {
        setError(caught instanceof Error ? caught.message : 'The search could not be started.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await executeSearch(query, pincode);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    latestQueryRef.current = value;
    
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        const list = await getSuggestions(value);
        if (latestQueryRef.current === value) {
          setSuggestions(list);
          setShowSuggestions(list.length > 0);
        }
      } catch (err) {
        console.error('Error loading suggestions:', err);
      }
    }, 200);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getUnitLabel = (form: string | null) => {
    if (!form) return 'unit';
    const lower = form.toLowerCase();
    if (lower.includes('syrup') || lower.includes('suspension') || lower.includes('liquid')) {
      return '5ml';
    }
    if (lower.includes('tablet') || lower.includes('capsule')) {
      return 'tablet/capsule';
    }
    if (lower.includes('drop')) {
      return 'ml';
    }
    if (lower.includes('injection') || lower.includes('vial') || lower.includes('ampoule')) {
      return 'ml';
    }
    if (lower.includes('cream') || lower.includes('gel') || lower.includes('ointment')) {
      return 'gram';
    }
    return 'unit';
  };

  const getChartData = () => {
    const pointsMap = new Map<string, Record<string, any>>();
    
    priceHistory.forEach((pt) => {
      const dateKey = formatDate(pt.collectedAt);
      const existing = pointsMap.get(dateKey) || { date: dateKey };
      existing[`${pt.retailer}_pack`] = pt.priceRupees;
      existing[`${pt.retailer}_unit`] = pt.unitPriceRupees;
      pointsMap.set(dateKey, existing);
    });

    return Array.from(pointsMap.values());
  };

  const chartData = getChartData();

  return (
    <div className="relative z-10 min-h-screen px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">Nirogi comparison</p>
          <h1 className="text-4xl font-bold text-text md:text-5xl">Compare medicine price snapshots</h1>
          <p className="mx-auto mt-4 max-w-2xl text-textSecondary">
            Real-time prices scraped from 1mg, Netmeds, and PharmEasy. Check strength, form, and pack before deciding.
          </p>
        </header>

        <section className="card mb-10 p-6 md:p-8">
          <form onSubmit={handleSearch} className="grid gap-4 md:grid-cols-[1fr_180px_auto]">
            <div className="relative flex flex-col justify-end">
              <span className="mb-2 block text-sm font-semibold text-text">Medicine</span>
              <div className="relative">
                <input
                  value={query}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  onFocus={() => setShowSuggestions(suggestions.length > 0)}
                  onBlur={() => window.setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="e.g. Dolo 650 tablet"
                  className="input-field"
                  disabled={loading}
                  autoComplete="off"
                />
                {showSuggestions && (
                  <ul className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-white py-1 shadow-lg">
                    {suggestions.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setQuery(item.displayName);
                            setShowSuggestions(false);
                            executeSearch(item.displayName, pincode);
                          }}
                          className="flex w-full flex-col px-4 py-2 text-left hover:bg-background transition-colors"
                        >
                          <span className="font-semibold text-text">{item.displayName}</span>
                          {item.genericName && (
                            <span className="text-xs text-textSecondary">{item.genericName}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <label>
              <span className="mb-2 block text-sm font-semibold text-text">
                Pincode <span className="font-normal text-textSecondary">(optional)</span>
              </span>
              <input
                value={pincode}
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setPincode(event.target.value.replace(/\D/g, ''))}
                placeholder="400001"
                className="input-field"
                disabled={loading}
              />
            </label>
            <button type="submit" className="btn-primary self-end whitespace-nowrap" disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </form>

          {loading && (
            <div className="mt-5 flex items-center gap-3 text-sm text-textSecondary">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              {notice || 'Scraping pharmacy websites, please wait…'}
            </div>
          )}

          {!loading && notice && (
            <div className="mt-5 flex items-center gap-2 rounded-lg border border-border bg-background p-4 text-sm text-textSecondary">
              {elapsedMs > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  ⏱ {formatDuration(elapsedMs)}
                </span>
              )}
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-error">{error}</p>
          )}
        </section>

        {results.length > 0 ? (
          <section className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('offers')}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                    activeTab === 'offers'
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-white border border-border text-textSecondary hover:text-text'
                  }`}
                >
                  Retailer Offers
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                    activeTab === 'history'
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-white border border-border text-textSecondary hover:text-text'
                  }`}
                >
                  Price Trend History
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-semibold text-text hover:bg-background transition-all shadow-sm"
                >
                  {shareCopied ? (
                    <>
                      <svg className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 text-textSecondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 10.742l-4.184 2.184m0 0l4.184 2.184m-4.184-2.184h12.578M19.5 8.25c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zM19.5 18.75c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5z" />
                      </svg>
                      Share Link
                    </>
                  )}
                </button>
                {elapsedMs > 0 && (
                  <span className="rounded-full border border-border bg-white px-3 py-1 text-sm text-textSecondary">
                    Fetched in <strong className="text-primary">{formatDuration(elapsedMs)}</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="relative transition-all duration-300">
              {activeTab === 'offers' ? (
                <div className="space-y-4 animate-fadeIn">
                  {results.map((offer) => (
                    <OfferCard
                      key={`${offer.retailer}-${offer.sourceUrl ?? offer.retailer}`}
                      offer={offer}
                      pincode={pincode}
                    />
                  ))}
                </div>
              ) : (
                <div className="card p-6 md:p-8 animate-fadeIn">
                  <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-text">Price Trend for {results[0]?.sourceTitle || query}</h2>
                      <p className="text-xs text-textSecondary mt-0.5">Historical price insights across retailers</p>
                    </div>
                    <div className="flex gap-3">
                      {['one-mg', 'netmeds', 'pharmeasy'].map((r) => (
                        <span key={r} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: RETAILER_COLORS[r] }}>
                          <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: RETAILER_COLORS[r] }} />
                          {RETAILER_LABELS[r]}
                        </span>
                      ))}
                    </div>
                  </div>

                  {historyLoading ? (
                    <div className="flex h-64 items-center justify-center text-sm text-textSecondary">
                      <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                      Loading price history...
                    </div>
                  ) : historyInsufficient || chartData.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background p-6 text-center text-textSecondary">
                      <svg className="h-8 w-8 text-textSecondary mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="font-semibold text-text">No price history yet</p>
                      <p className="text-xs max-w-sm mt-1">Price history will accumulate with every search. Check back over time to see trends.</p>
                    </div>
                  ) : (
                    <div className="space-y-12">
                      {/* Chart 1: Pack Price */}
                      <div>
                        <div className="mb-4">
                          <h3 className="text-sm font-bold text-text">Total Pack Price</h3>
                          <p className="text-xs text-textSecondary">Retailer listing price</p>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id="color-one-mg-pack" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={RETAILER_COLORS['one-mg']} stopOpacity={0.15} />
                                  <stop offset="95%" stopColor={RETAILER_COLORS['one-mg']} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="color-netmeds-pack" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={RETAILER_COLORS['netmeds']} stopOpacity={0.15} />
                                  <stop offset="95%" stopColor={RETAILER_COLORS['netmeds']} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="color-pharmeasy-pack" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={RETAILER_COLORS['pharmeasy']} stopOpacity={0.15} />
                                  <stop offset="95%" stopColor={RETAILER_COLORS['pharmeasy']} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                              <XAxis
                                dataKey="date"
                                tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'inherit' }}
                                axisLine={false}
                                tickLine={false}
                                padding={{ left: 10, right: 10 }}
                              />
                              <YAxis
                                tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'inherit' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => `₹${val}`}
                                width={55}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#fff',
                                  borderRadius: '14px',
                                  border: '1px solid #e5e7eb',
                                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                                  padding: '10px 14px',
                                  fontSize: '13px',
                                }}
                                labelStyle={{ fontWeight: '700', color: '#1f2937', marginBottom: '4px' }}
                                cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                              />
                              <Area
                                type="monotone"
                                dataKey="one-mg_pack"
                                name="1mg"
                                stroke={RETAILER_COLORS['one-mg']}
                                strokeWidth={2.5}
                                fill="url(#color-one-mg-pack)"
                                dot={{ r: 4, fill: RETAILER_COLORS['one-mg'], strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                                connectNulls
                              />
                              <Area
                                type="monotone"
                                dataKey="netmeds_pack"
                                name="Netmeds"
                                stroke={RETAILER_COLORS['netmeds']}
                                strokeWidth={2.5}
                                fill="url(#color-netmeds-pack)"
                                dot={{ r: 4, fill: RETAILER_COLORS['netmeds'], strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                                connectNulls
                              />
                              <Area
                                type="monotone"
                                dataKey="pharmeasy_pack"
                                name="PharmEasy"
                                stroke={RETAILER_COLORS['pharmeasy']}
                                strokeWidth={2.5}
                                fill="url(#color-pharmeasy-pack)"
                                dot={{ r: 4, fill: RETAILER_COLORS['pharmeasy'], strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                                connectNulls
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Chart 2: Unit Price */}
                      <div>
                        <div className="mb-4">
                          <h3 className="text-sm font-bold text-text">Unit Price Trend</h3>
                          <p className="text-xs text-textSecondary">Price normalized per {getUnitLabel(dosageForm)}</p>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id="color-one-mg-unit" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={RETAILER_COLORS['one-mg']} stopOpacity={0.15} />
                                  <stop offset="95%" stopColor={RETAILER_COLORS['one-mg']} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="color-netmeds-unit" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={RETAILER_COLORS['netmeds']} stopOpacity={0.15} />
                                  <stop offset="95%" stopColor={RETAILER_COLORS['netmeds']} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="color-pharmeasy-unit" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={RETAILER_COLORS['pharmeasy']} stopOpacity={0.15} />
                                  <stop offset="95%" stopColor={RETAILER_COLORS['pharmeasy']} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                              <XAxis
                                dataKey="date"
                                tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'inherit' }}
                                axisLine={false}
                                tickLine={false}
                                padding={{ left: 10, right: 10 }}
                              />
                              <YAxis
                                tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'inherit' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => `₹${val}`}
                                width={55}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#fff',
                                  borderRadius: '14px',
                                  border: '1px solid #e5e7eb',
                                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                                  padding: '10px 14px',
                                  fontSize: '13px',
                                }}
                                labelStyle={{ fontWeight: '700', color: '#1f2937', marginBottom: '4px' }}
                                cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                              />
                              <Area
                                type="monotone"
                                dataKey="one-mg_unit"
                                name="1mg"
                                stroke={RETAILER_COLORS['one-mg']}
                                strokeWidth={2.5}
                                fill="url(#color-one-mg-unit)"
                                dot={{ r: 4, fill: RETAILER_COLORS['one-mg'], strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                                connectNulls
                              />
                              <Area
                                type="monotone"
                                dataKey="netmeds_unit"
                                name="Netmeds"
                                stroke={RETAILER_COLORS['netmeds']}
                                strokeWidth={2.5}
                                fill="url(#color-netmeds-unit)"
                                dot={{ r: 4, fill: RETAILER_COLORS['netmeds'], strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                                connectNulls
                              />
                              <Area
                                type="monotone"
                                dataKey="pharmeasy_unit"
                                name="PharmEasy"
                                stroke={RETAILER_COLORS['pharmeasy']}
                                strokeWidth={2.5}
                                fill="url(#color-pharmeasy-unit)"
                                dot={{ r: 4, fill: RETAILER_COLORS['pharmeasy'], strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                                connectNulls
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        ) : (
          !loading && (
            <section className="rounded-2xl border border-dashed border-border bg-white/60 p-10 text-center text-textSecondary">
              Submit a search to collect and compare real-time medicine prices from 1mg, Netmeds, and PharmEasy.
            </section>
          )
        )}
      </div>

      {/* Floating Clipboard Copy Toast */}
      {shareCopied && (
        <>
          <style>{`
            @keyframes slideUp {
              from {
                transform: translate(-50%, 20px);
                opacity: 0;
              }
              to {
                transform: translate(-50%, 0);
                opacity: 1;
              }
            }
          `}</style>
          <div 
            className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-gray-900 px-5 py-3 text-sm font-bold text-white shadow-2xl transition-all duration-300 flex items-center gap-2 border border-white/10"
            style={{
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)'
            }}
          >
            <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
            <span>Link copied to clipboard!</span>
          </div>
        </>
      )}
    </div>
  );
};
