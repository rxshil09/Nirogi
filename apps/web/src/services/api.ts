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
    const message = typeof payload === 'object' && payload !== null && 'message' in payload
      ? String(payload.message)
      : 'The request could not be completed.';
    throw new ApiError(message, response.status);
  }

  return payload as T;
};

export const submitSearch = async (input: SearchRequest): Promise<SearchJobResponse> =>
  SearchJobResponseSchema.parse(await request<unknown>('/v1/searches', {
    method: 'POST',
    body: JSON.stringify(input),
  }));

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
