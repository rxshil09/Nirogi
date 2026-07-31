import {
  SearchJobResponseSchema,
  SearchResultResponseSchema,
  type SearchJobResponse,
  type SearchRequest,
  type SearchResultResponse,
} from '@nirogi/contracts';

const apiOrigin = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiOrigin}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options?.headers },
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String(payload.message)
        : 'The request could not be completed.';
    throw new ApiError(message, response.status);
  }

  return payload as T;
};

export const submitSearch = async (input: SearchRequest): Promise<SearchJobResponse> =>
  SearchJobResponseSchema.parse(
    await request<unknown>('/v1/searches', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );

export const getSearchJob = async (searchJobId: string): Promise<SearchResultResponse> =>
  SearchResultResponseSchema.parse(await request<unknown>(`/v1/searches/${searchJobId}`));

export interface SuggestionProduct {
  id: string;
  displayName: string;
  brandName: string | null;
  genericName: string | null;
  variants: {
    id: string;
    strengthValue: string | null;
    strengthUnit: string | null;
    dosageForm: string | null;
    packQuantity: number | null;
    packUnit: string | null;
    manufacturerName: string | null;
  }[];
}

export const getSuggestions = async (q: string): Promise<SuggestionProduct[]> => {
  const data = await request<{ suggestions: SuggestionProduct[] }>(`/v1/catalog/suggestions?q=${encodeURIComponent(q)}`);
  return data.suggestions;
};

export interface PriceHistoryPoint {
  pricePaise: number;
  priceRupees: number;
  unitPriceRupees: number;
  collectedAt: string;
  retailer: string;
}

export interface PriceHistoryResponse {
  productVariantId: string;
  dosageForm: string | null;
  insufficientData: boolean;
  history: PriceHistoryPoint[];
}

export const getPriceHistory = async (productVariantId: string, days = 30): Promise<PriceHistoryResponse> => {
  return request<PriceHistoryResponse>(`/v1/products/${productVariantId}/price-history?days=${days}`);
};

export interface ScraperMetricsResponse {
  service: string;
  windowHours: number;
  timestamp: string;
  uptimeSeconds: number;
  health: {
    database: { status: string; latencyMs: number };
    redis: { status: string; latencyMs: number };
  };
  queue: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
  } | null;
  catalog: {
    products: number;
    variants: number;
    listings: number;
    observations: number;
  };
  searchTelemetry: {
    totalJobs: number;
    completed: number;
    partial: number;
    failed: number;
    cacheHits?: number;
    cacheHitRatePercent: number;
  };
  summary: {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    overallSuccessRatePercent: number;
    overallAvgDurationMs: number;
  };
  retailers: {
    retailerSlug: string;
    displayName?: string;
    total: number;
    success: number;
    failed: number;
    successRatePercent: number;
    avgDurationMs: number;
  }[];
  tiers: {
    tier: string;
    displayName?: string;
    count: number;
    percentage: number;
    avgDurationMs: number;
  }[];
  recentFailures: {
    id: string;
    searchQuery?: string;
    retailerSlug: string;
    tier: string;
    status?: string;
    errorMessage: string;
    createdAt: string;
  }[];
}

export const getScraperMetrics = async (windowHours = 24): Promise<ScraperMetricsResponse> => {
  return request<ScraperMetricsResponse>(`/v1/metrics/scrapers?windowHours=${windowHours}`);
};
