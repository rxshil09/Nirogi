export interface SearchJobPayload {
  searchJobId: string;
  query: string;
  pincode?: string;
  retailerSlugs?: string[];
}
