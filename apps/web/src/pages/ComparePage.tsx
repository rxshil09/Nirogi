import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SourceOffer } from '../types/search.js';
import { ApiError, getSearchJob, submitSearch, getSuggestions, getPriceHistory, type SuggestionProduct, type PriceHistoryPoint } from '../services/api.js';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

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
  'one-mg': '#E11D48',
  netmeds: '#0F766E',
  pharmeasy: '#10B981',
};

const RETAILER_CARD_THEMES: Record<string, { bg: string; border: string; pill: string; price: string; lightBg: string }> = {
  'one-mg': {
    bg: 'bg-gradient-to-b from-rose-50/70 via-white to-white',
    border: 'border-rose-200/90 hover:border-rose-300',
    pill: 'bg-rose-600 text-white shadow-sm',
    price: 'text-rose-700',
    lightBg: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  netmeds: {
    bg: 'bg-gradient-to-b from-teal-50/70 via-white to-white',
    border: 'border-teal-200/90 hover:border-teal-300',
    pill: 'bg-teal-700 text-white shadow-sm',
    price: 'text-teal-800',
    lightBg: 'bg-teal-50 text-teal-800 border-teal-200',
  },
  pharmeasy: {
    bg: 'bg-gradient-to-b from-emerald-50/70 via-white to-white',
    border: 'border-emerald-200/90 hover:border-emerald-300',
    pill: 'bg-emerald-600 text-white shadow-sm',
    price: 'text-emerald-700',
    lightBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
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

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatFullDateWithSeconds = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

const formatChartTickDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
};

const OfferCard = ({
  offer,
  pincode,
  isLowestPrice,
  isHighlighted,
  layoutMode = 'grid',
}: {
  offer: SourceOffer;
  pincode?: string;
  isLowestPrice?: boolean;
  isHighlighted?: boolean;
  layoutMode?: 'grid' | 'list';
}) => {
  const label = RETAILER_LABELS[offer.retailer] ?? offer.retailer;
  const theme = RETAILER_CARD_THEMES[offer.retailer] ?? {
    bg: 'bg-white',
    border: 'border-slate-200',
    pill: 'bg-slate-700 text-white',
    price: 'text-slate-900',
    lightBg: 'bg-slate-100 text-slate-800 border-slate-200',
  };

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
    <article
      id={`offer-card-${offer.retailer}`}
      className={`glass-card p-6 transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
        theme.bg
      } ${
        isHighlighted
          ? 'ring-4 ring-emerald-500 scale-[1.02] shadow-2xl border-emerald-500'
          : isLowestPrice && !isNotFound && !isSearching
          ? 'border-emerald-400 ring-2 ring-emerald-500/20 shadow-xl'
          : isNotFound
          ? 'border-dashed border-slate-300 opacity-60 bg-slate-50/50'
          : theme.border
      } ${isSearching ? 'animate-pulse' : ''}`}
    >
      <div className={layoutMode === 'list' ? 'flex flex-col md:flex-row md:items-center md:justify-between gap-6' : 'flex flex-col h-full justify-between'}>
        
        {/* Top Content Area */}
        <div className="flex-1 flex flex-col justify-start">
          
          {/* Section 1: Header Badges (Pharmacy Pill & Lowest Price Pill in Row 1 — Fixed Height Slot min-h-[58px]) */}
          <div className="min-h-[58px] flex flex-col justify-between mb-3">
            <div className="flex items-center gap-2 h-7 flex-wrap">
              <span className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${theme.pill}`}>
                {label}
              </span>

              {isLowestPrice && !isNotFound && !isSearching && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-extrabold text-white uppercase tracking-wider shadow-2xs">
                  Lowest Price
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 h-5">
              {offer.tierUsed === 'tier1_ssr' && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/80 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs">
                  Fast SSR
                </span>
              )}
              {offer.tierUsed === 'tier2_serp' && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/80 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs">
                  SerpAPI
                </span>
              )}
              {offer.tierUsed === 'tier3_playwright' && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/80 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs">
                  DOM Fallback
                </span>
              )}
              {offer.fetchTimeMs !== null && (
                <span className="text-xs text-slate-400">Fetched in {formatDuration(offer.fetchTimeMs)}</span>
              )}
            </div>
          </div>

          {/* Section 2: Medicine Title (Fixed Height Slot min-h-[60px] to preserve vertical alignment) */}
          <div className={layoutMode === 'grid' ? 'min-h-[60px] flex items-start mb-2.5' : 'mb-2.5'}>
            {isSearching ? (
              <div className="space-y-2 w-full">
                <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
              </div>
            ) : isNotFound ? (
              <p className="text-base text-slate-500 italic">Not listed on {label}</p>
            ) : (
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug line-clamp-2" title={offer.sourceTitle ?? 'Medicine listing'}>
                {offer.sourceTitle ?? 'Medicine listing'}
              </h3>
            )}
          </div>

          {/* Section 3: Metadata Block (Manufacturer Tag, Match Status, Full Checked Timestamp — Fixed Height Slot min-h-[76px]) */}
          {!isNotFound && !isSearching && (
            <div className={layoutMode === 'grid' ? 'min-h-[76px] flex flex-col justify-start space-y-2 mb-4' : 'space-y-2 mb-4'}>
              <div className="flex flex-wrap gap-2 items-center min-h-[24px]">
                {offer.manufacturerName ? (
                  <span className="inline-flex items-center rounded-md bg-white/90 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-800 shadow-2xs">
                    {offer.manufacturerName}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-400 italic">
                    Manufacturer unspecified
                  </span>
                )}
                {offer.matchStatus === 'candidate' && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    Candidate Match
                  </span>
                )}
                {offer.availability === 'not_for_sale' && (
                  <span className="inline-flex items-center rounded-md bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                    Not delivered to area
                  </span>
                )}
                {offer.availability === 'out_of_stock' && (
                  <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    Out of Stock
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Match: <span className="font-semibold text-slate-700 capitalize">{offer.matchStatus.replace('_', ' ')}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Checked: {formatFullDateWithSeconds(offer.collectedAt)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Pricing & Action Button */}
        {isSearching ? (
          <div className="text-left sm:text-right mt-2 sm:mt-0 space-y-2">
            <div className="h-8 w-28 bg-slate-200 rounded animate-pulse sm:ml-auto" />
            <div className="h-4 w-16 bg-slate-100 rounded animate-pulse sm:ml-auto" />
          </div>
        ) : !isNotFound && (
          <div className={`shrink-0 ${layoutMode === 'list' ? 'text-left md:text-right flex flex-col md:items-end justify-between gap-3' : 'text-left pt-4 border-t border-slate-100 mt-auto min-h-[145px] flex flex-col justify-between space-y-3'}`}>
            <div>
              {offer.pricePaise !== null ? (
                <>
                  <div className={`flex items-baseline gap-2 ${layoutMode === 'list' ? 'md:justify-end' : ''}`}>
                    <span className={`text-3xl font-black tracking-tight ${theme.price}`}>
                      {formatMoney(offer.pricePaise)}
                    </span>
                  </div>

                  {offer.mrpPaise !== null && offer.mrpPaise > (offer.pricePaise ?? 0) && (
                    <p className="text-xs text-slate-400 line-through mt-0.5">
                      MRP {formatMoney(offer.mrpPaise)}
                    </p>
                  )}

                  {offer.pricePerUnit && (
                    <p className="text-xs font-semibold text-slate-500 mt-1">{offer.pricePerUnit}</p>
                  )}

                  {offer.discountPercent !== null && offer.discountPercent > 0 && offer.availability !== 'not_for_sale' && (
                    <span className="mt-1.5 inline-block rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      {offer.discountPercent}% OFF
                    </span>
                  )}
                </>
              ) : (
                <div>
                  <p className="text-lg font-bold text-rose-600">
                    {offer.availability === 'not_for_sale'
                      ? 'Not for sale'
                      : offer.availability === 'out_of_stock'
                      ? 'Out of stock'
                      : 'Price unavailable'}
                  </p>
                </div>
              )}
            </div>

            {localizedUrl ? (
              <a
                href={localizedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 font-bold text-xs text-slate-900 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl shadow-2xs transition-all w-full md:w-auto"
              >
                <span>Visit {label}</span>
                <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
};

const MEDICINE_QUERY_REGEX = /^[a-zA-Z0-9\s\-\.\/%()]+$/;

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
  const isSearchingRef = useRef<boolean>(false);
  const initialMountRef = useRef<boolean>(false);

  // Layout mode state & highlighted card state
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [highlightedRetailer, setHighlightedRetailer] = useState<string | null>(null);

  // Chart sub-tab state ('pack' | 'unit')
  const [chartSubTab, setChartSubTab] = useState<'pack' | 'unit'>('pack');

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

  useEffect(() => {
    if (initialMountRef.current) return;
    initialMountRef.current = true;

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

        if (result.productVariantId) {
          loadHistory(result.productVariantId);
        }

        console.group(`%c🔍 Nirogi Search Complete — "${query}"`, 'color: #E11D48; font-weight: bold; font-size: 14px;');
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

        setNotice(result.status === 'completed' ? 'All pharmacy results collected.' : 'Results collected (some sources completed).');
        return true;
      } else if (result.status === 'failed') {
        setError('The search job failed to collect results.');
        return true;
      } else if (result.status === 'cancelled') {
        setError('The search job was cancelled.');
        return true;
      } else {
        const elapsed = now - startTimeRef.current;
        setNotice(`Searching pharmacy catalogs… (${formatDuration(elapsed)} elapsed)`);
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
    if (!MEDICINE_QUERY_REGEX.test(trimmedQuery)) {
      setError('Query contains invalid characters. Please use letters, numbers, spaces, or standard medicine symbols (- . / % ()).');
      return;
    }
    if (targetPincode && !/^\d{6}$/.test(targetPincode)) {
      setError('Pincode must contain six digits.');
      return;
    }

    if (isSearchingRef.current) return;
    isSearchingRef.current = true;

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

    try {
      const job = await submitSearch({ query: trimmedQuery, ...(targetPincode ? { pincode: targetPincode } : {}) });

      if (job.status === 'completed' || job.status === 'partial') {
        startTimeRef.current = Date.now();
        await pollForResults(job.searchJobId);
        return;
      }

      setNotice('Search queued. Scraping live pharmacy catalog offers…');

      let attempts = 0;
      const maxAttempts = 60;
      let isDone = false;

      const getDelay = (attempt: number) =>
        attempt === 0 ? 600 : attempt === 1 ? 800 : attempt < 5 ? 1000 : 1500;

      while (!isDone && attempts < maxAttempts) {
        await new Promise((resolve) => window.setTimeout(resolve, getDelay(attempts)));
        isDone = await pollForResults(job.searchJobId);
        attempts++;
      }

      if (!isDone) {
        setNotice('Search is taking longer than expected. Please refresh or try again.');
      }
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.status === 503) {
        setError('The search service is currently unavailable. Ensure worker services are online.');
      } else {
        setError(caught instanceof Error ? caught.message : 'The search could not be started.');
      }
    } finally {
      setLoading(false);
      isSearchingRef.current = false;
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
      const fullLabel = formatDate(pt.collectedAt);
      const tickLabel = formatChartTickDate(pt.collectedAt);
      const existing = pointsMap.get(fullLabel) || { date: tickLabel, fullDate: fullLabel };
      existing[`${pt.retailer}_pack`] = pt.priceRupees;
      existing[`${pt.retailer}_unit`] = pt.unitPriceRupees;
      pointsMap.set(fullLabel, existing);
    });

    return Array.from(pointsMap.values());
  };

  const chartData = getChartData();

  // Find lowest price offer
  const validPricedOffers = results.filter(
    (o) => o.pricePaise !== null && o.availability !== 'not_found' && o.availability !== 'not_for_sale'
  );
  const minPricePaise = validPricedOffers.length > 0
    ? Math.min(...validPricedOffers.map((o) => o.pricePaise!))
    : null;

  const lowestOffer = minPricePaise !== null
    ? validPricedOffers.find((o) => o.pricePaise === minPricePaise)
    : null;

  const scrollToLowestOfferCard = () => {
    if (!lowestOffer) return;
    const cardId = `offer-card-${lowestOffer.retailer}`;
    const el = document.getElementById(cardId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedRetailer(lowestOffer.retailer);
      setTimeout(() => setHighlightedRetailer(null), 1000);
    }
  };

  return (
    <div className="relative z-10 min-h-screen px-4 py-10 md:py-16">
      <div className="mx-auto max-w-5xl space-y-8">
        
        {/* Header Title */}
        <header className="text-center max-w-3xl mx-auto">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Compare Medicine Prices
          </h1>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">
            Real-time price snapshots collected directly from <span className="font-bold text-rose-600">1mg</span>, <span className="font-bold text-teal-700">Netmeds</span>, and <span className="font-bold text-emerald-700">PharmEasy</span>.
          </p>
        </header>

        {/* Search Control Card (Pixel-perfect aligned inputs & button) */}
        <section className="glass-card p-6 sm:p-8 shadow-xl border-slate-200/90 relative">
          <form onSubmit={handleSearch} className="grid gap-4 md:grid-cols-[1fr_160px_auto] items-end">
            <div className="relative">
              <label htmlFor="medicine-input" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Medicine Name
              </label>
              <div className="relative">
                <input
                  id="medicine-input"
                  type="text"
                  value={query}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  onFocus={() => setShowSuggestions(suggestions.length > 0)}
                  onBlur={() => window.setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Enter medicine (e.g. Dolo 650, Pan 40)..."
                  className="input-field h-[46px] py-2.5 pl-4 pr-10 text-base font-medium"
                  disabled={loading}
                  autoComplete="off"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => { setQuery(''); setSuggestions([]); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}

                {/* Suggestions Dropdown — ONLY render if suggestions exist */}
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-2xl backdrop-blur-xl">
                    {suggestions.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setQuery(item.displayName);
                            setShowSuggestions(false);
                            executeSearch(item.displayName, pincode);
                          }}
                          className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-rose-50/60 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <span className="font-semibold text-slate-900">{item.displayName}</span>
                          {item.genericName && (
                            <span className="text-xs text-slate-500 mt-0.5">{item.genericName}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Numeric Pincode Input */}
            <div className="w-full">
              <label htmlFor="pincode-input" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Pincode <span className="font-normal text-slate-400 text-[10px]">(Optional)</span>
              </label>
              <input
                id="pincode-input"
                type="text"
                value={pincode}
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setPincode(event.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 400001"
                className="input-field h-[46px] py-2.5 text-base font-medium"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn-primary font-semibold flex items-center justify-center gap-2 whitespace-nowrap shadow-md h-[46px] px-8"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Searching…</span>
                </>
              ) : (
                <>
                  <span>Compare</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Status Notices */}
          {loading && (
            <div className="mt-4 flex items-center gap-3 text-sm font-medium text-slate-600 bg-rose-50/60 rounded-xl p-3.5 border border-rose-100">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
              <span>{notice || 'Scraping pharmacy catalog websites, please wait…'}</span>
            </div>
          )}

          {!loading && notice && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 font-medium">
              <span>{notice}</span>
              {elapsedMs > 0 && (
                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 font-bold text-slate-700">
                  Total fetch time: {formatDuration(elapsedMs)}
                </span>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700 flex items-center gap-2">
              <svg className="h-5 w-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* Real-time Scraper Skeleton Cards while Loading (Respecting layoutMode) */}
        {loading && results.length === 0 && (
          <section className="space-y-4">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Scraping Live Catalog Offers</p>
              <p className="text-sm font-semibold text-slate-700 mt-1">Connecting to 1mg, Netmeds, and PharmEasy...</p>
            </div>
            
            <div className={layoutMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-3 gap-6' : 'space-y-4'}>
              {['1mg', 'Netmeds', 'PharmEasy'].map((pharm) => (
                <div key={pharm} className={`glass-card p-6 border-slate-200/80 animate-pulse ${layoutMode === 'list' ? 'flex flex-col md:flex-row md:items-center justify-between gap-4' : 'space-y-4'}`}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="h-6 w-20 bg-slate-200 rounded-lg" />
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-3/4 bg-slate-200 rounded" />
                    <div className="h-4 w-1/2 bg-slate-100 rounded" />
                  </div>
                  <div className="pt-2 flex items-center justify-between gap-4">
                    <div className="h-8 w-24 bg-slate-200 rounded" />
                    <div className="h-8 w-20 bg-slate-100 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Results Container */}
        {results.length > 0 ? (
          <section className="space-y-6">
            
            {/* Clickable Bright Snapshot Banner (Takes user to lowest offer card & highlights it) */}
            {lowestOffer && (
              <button
                type="button"
                onClick={scrollToLowestOfferCard}
                className="w-full text-left rounded-2xl bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-emerald-50/90 border border-emerald-200/90 text-slate-900 p-6 sm:p-7 shadow-md transition-all hover:border-emerald-400 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group cursor-pointer"
              >
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-extrabold text-white uppercase tracking-wider mb-2 shadow-2xs">
                    Lowest Price Snapshot (Click to View) &rarr;
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 group-hover:text-emerald-800 transition-colors">
                    Lowest price found on <span className="text-emerald-700 underline decoration-emerald-300">{RETAILER_LABELS[lowestOffer.retailer] ?? lowestOffer.retailer}</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                    {lowestOffer.sourceTitle ?? query}
                  </p>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <span className="text-3xl sm:text-4xl font-black text-emerald-700">{formatMoney(lowestOffer.pricePaise)}</span>
                  {lowestOffer.mrpPaise && lowestOffer.mrpPaise > (lowestOffer.pricePaise ?? 0) && (
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      MRP {formatMoney(lowestOffer.mrpPaise)} ({lowestOffer.discountPercent}% OFF)
                    </p>
                  )}
                </div>
              </button>
            )}

            {/* Navigation Bar, Layout Switcher & Sharing (Strict h-10 Height Alignment) */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('offers')}
                  className={`h-10 inline-flex items-center justify-center px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    activeTab === 'offers'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Pharmacy Offers ({results.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`h-10 inline-flex items-center justify-center px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    activeTab === 'history'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Price Trend History
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Layout Mode Switcher (Strict h-10 container) */}
                {activeTab === 'offers' && (
                  <div className="h-10 inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setLayoutMode('grid')}
                      aria-label="Grid View"
                      title="Grid View"
                      className={`h-8 w-8 inline-flex items-center justify-center rounded-lg transition-all ${
                        layoutMode === 'grid'
                          ? 'bg-rose-50 text-primary font-bold shadow-2xs'
                          : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
                        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
                        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
                        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayoutMode('list')}
                      aria-label="List View"
                      title="List View"
                      className={`h-8 w-8 inline-flex items-center justify-center rounded-lg transition-all ${
                        layoutMode === 'list'
                          ? 'bg-rose-50 text-primary font-bold shadow-2xs'
                          : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 5.25h16.5m-16.5-10.5h16.5" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Share Button (Strict h-10 container) */}
                <button
                  type="button"
                  onClick={handleShare}
                  className="h-10 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs"
                >
                  {shareCopied ? (
                    <>
                      <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 10.742l-4.184 2.184m0 0l4.184 2.184m-4.184-2.184h12.578M19.5 8.25c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zM19.5 18.75c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5z" />
                      </svg>
                      <span>Share</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Tab Views */}
            <div className="relative transition-all duration-300">
              {activeTab === 'offers' ? (
                <div className="space-y-6">
                  <div className={layoutMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch' : 'space-y-4'}>
                    {results.map((offer) => (
                      <OfferCard
                        key={`${offer.retailer}-${offer.sourceUrl ?? offer.retailer}`}
                        offer={offer}
                        pincode={pincode}
                        isLowestPrice={offer.pricePaise !== null && offer.pricePaise === minPricePaise}
                        isHighlighted={highlightedRetailer === offer.retailer}
                        layoutMode={layoutMode}
                      />
                    ))}
                  </div>

                  {/* Single Clean Disclaimer Banner at Bottom of Results */}
                  <div className="rounded-2xl bg-slate-100/70 border border-slate-200/80 p-4 text-center text-xs text-slate-500 font-medium">
                    Information collected from public pharmacy catalog listings for comparison only. Always verify medicine strength, pack size, and expiration date with your pharmacist.
                  </div>
                </div>
              ) : (
                <div className="glass-card p-6 md:p-8 shadow-xl border-slate-200/90 space-y-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">
                        Price Trend History
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">Historical pricing comparison for {results[0]?.sourceTitle || query}</p>
                    </div>
                    <div className="flex gap-4 items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                      {['one-mg', 'netmeds', 'pharmeasy'].map((r) => (
                        <span key={r} className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: RETAILER_COLORS[r] }} />
                          {RETAILER_LABELS[r]}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Clickable Sub-Section Tabs for Charts (No Long Scrolling Needed!) */}
                  <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
                    <button
                      type="button"
                      onClick={() => setChartSubTab('pack')}
                      className={`h-9 px-4 rounded-xl text-xs font-bold transition-all ${
                        chartSubTab === 'pack'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Total Pack Listing Price
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartSubTab('unit')}
                      className={`h-9 px-4 rounded-xl text-xs font-bold transition-all ${
                        chartSubTab === 'unit'
                          ? 'bg-teal-700 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Unit Price Trend
                    </button>
                  </div>

                  {historyLoading ? (
                    <div className="flex h-64 items-center justify-center text-sm font-medium text-slate-500">
                      <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mr-3" />
                      Loading price trend data...
                    </div>
                  ) : historyInsufficient || chartData.length === 0 ? (
                    <div className="flex h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-slate-500">
                      <svg className="h-8 w-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="font-bold text-slate-800">Initial Price Snapshot Recorded</p>
                      <p className="text-xs max-w-md mt-1">
                        Historical trend graphs accumulate data points over time as searches are performed.
                      </p>
                    </div>
                  ) : (
                    <div>
                      {/* Sub-Section 1: Total Pack Listing Price */}
                      {chartSubTab === 'pack' && (
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
                          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                            <div>
                              <h3 className="text-base font-bold text-slate-900">Total Pack Listing Price</h3>
                              <p className="text-xs text-slate-500">Direct listed MRP vs offer price per pack across pharmacies</p>
                            </div>
                            <span className="text-xs font-semibold text-slate-400">Y-Axis: Price (₹) • X-Axis: Date</span>
                          </div>
                          <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData} margin={{ top: 10, right: 15, left: 10, bottom: 25 }}>
                                <defs>
                                  <linearGradient id="color-one-mg-pack" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={RETAILER_COLORS['one-mg']} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={RETAILER_COLORS['one-mg']} stopOpacity={0} />
                                  </linearGradient>
                                  <linearGradient id="color-netmeds-pack" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={RETAILER_COLORS['netmeds']} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={RETAILER_COLORS['netmeds']} stopOpacity={0} />
                                  </linearGradient>
                                  <linearGradient id="color-pharmeasy-pack" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={RETAILER_COLORS['pharmeasy']} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={RETAILER_COLORS['pharmeasy']} stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                  dataKey="date"
                                  minTickGap={35}
                                  interval="preserveStartEnd"
                                  tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                                  axisLine={{ stroke: '#CBD5E1' }}
                                  tickLine={false}
                                  dy={8}
                                />
                                <YAxis
                                  tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(val) => `₹${val}`}
                                  width={50}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: '#0F172A',
                                    borderRadius: '12px',
                                    border: '1px solid #334155',
                                    color: '#fff',
                                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
                                    padding: '12px 16px',
                                    fontSize: '13px',
                                  }}
                                  labelStyle={{ fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}
                                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                                />
                                <Area type="monotone" dataKey="one-mg_pack" name="1mg" stroke={RETAILER_COLORS['one-mg']} strokeWidth={3} fill="url(#color-one-mg-pack)" dot={{ r: 4, fill: RETAILER_COLORS['one-mg'] }} activeDot={{ r: 6 }} connectNulls />
                                <Area type="monotone" dataKey="netmeds_pack" name="Netmeds" stroke={RETAILER_COLORS['netmeds']} strokeWidth={3} fill="url(#color-netmeds-pack)" dot={{ r: 4, fill: RETAILER_COLORS['netmeds'] }} activeDot={{ r: 6 }} connectNulls />
                                <Area type="monotone" dataKey="pharmeasy_pack" name="PharmEasy" stroke={RETAILER_COLORS['pharmeasy']} strokeWidth={3} fill="url(#color-pharmeasy-pack)" dot={{ r: 4, fill: RETAILER_COLORS['pharmeasy'] }} connectNulls />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Sub-Section 2: Unit Price Trend */}
                      {chartSubTab === 'unit' && (
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
                          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                            <div>
                              <h3 className="text-base font-bold text-slate-900">Unit Price Trend</h3>
                              <p className="text-xs text-slate-500">Normalized price per {getUnitLabel(dosageForm)} across pharmacies</p>
                            </div>
                            <span className="text-xs font-semibold text-slate-400">Y-Axis: Price/Unit (₹) • X-Axis: Date</span>
                          </div>
                          <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData} margin={{ top: 10, right: 15, left: 10, bottom: 25 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                  dataKey="date"
                                  minTickGap={35}
                                  interval="preserveStartEnd"
                                  tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                                  axisLine={{ stroke: '#CBD5E1' }}
                                  tickLine={false}
                                  dy={8}
                                />
                                <YAxis
                                  tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(val) => `₹${val}`}
                                  width={50}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: '#0F172A',
                                    borderRadius: '12px',
                                    border: '1px solid #334155',
                                    color: '#fff',
                                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
                                    padding: '12px 16px',
                                    fontSize: '13px',
                                  }}
                                  labelStyle={{ fontWeight: '700', color: '#94A3B8', marginBottom: '6px' }}
                                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                                />
                                <Area type="monotone" dataKey="one-mg_unit" name="1mg" stroke={RETAILER_COLORS['one-mg']} strokeWidth={3} fill="url(#color-one-mg-pack)" dot={{ r: 4, fill: RETAILER_COLORS['one-mg'] }} activeDot={{ r: 6 }} connectNulls />
                                <Area type="monotone" dataKey="netmeds_unit" name="Netmeds" stroke={RETAILER_COLORS['netmeds']} strokeWidth={3} fill="url(#color-netmeds-pack)" dot={{ r: 4, fill: RETAILER_COLORS['netmeds'] }} activeDot={{ r: 6 }} connectNulls />
                                <Area type="monotone" dataKey="pharmeasy_unit" name="PharmEasy" stroke={RETAILER_COLORS['pharmeasy']} strokeWidth={3} fill="url(#color-pharmeasy-pack)" dot={{ r: 4, fill: RETAILER_COLORS['pharmeasy'] }} connectNulls />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        ) : (
          !loading && (
            <section className="glass-card p-10 text-center border-dashed border-slate-300">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-primary mb-4">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">Start a medicine price search</h3>
              <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Enter a medicine brand or formulation above to scrape and compare real-time pricing across 1mg, Netmeds, and PharmEasy.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <span className="text-xs font-bold text-slate-400 self-center mr-1">Popular searches:</span>
                {['Dolo 650', 'Pan 40', 'Crocin 650', 'Augmentin 625'].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setQuery(sample);
                      executeSearch(sample, pincode);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary transition-all"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </section>
          )
        )}
      </div>

      {/* Floating Clipboard Copy Toast */}
      {shareCopied && (
        <div 
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-bold text-white shadow-2xl transition-all duration-300 flex items-center gap-2 border border-slate-700"
        >
          <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          <span>Share link copied to clipboard!</span>
        </div>
      )}
    </div>
  );
};
