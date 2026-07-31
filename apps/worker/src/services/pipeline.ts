import { buildNormalisedVariantKey, canonicalUrl, parseMedicineTitle } from '@nirogi/domain';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { SharedBrowser } from '../lib/browser.js';
import { getAdapter } from '../adapters/index.js';
import type { SearchInput } from '../adapters/types.js';

export interface PipelineJobInput {
  searchJobId: string;
  query: string;
  pincode?: string;
  retailerSlugs?: string[];
}

/**
 * Run the full search pipeline for one job:
 * 1. Mark the job as running.
 * 2. For each active retailer, create a ScrapeAttempt and invoke the adapter.
 * 3. On success, upsert RetailerListing + MedicineProduct + ProductVariant, then write a PriceObservation.
 * 4. Mark each attempt succeeded/failed independently.
 * 5. Mark the overall job completed, partial, or failed.
 */
export const runPipeline = async (input: PipelineJobInput): Promise<void> => {
  const { searchJobId, query, pincode, retailerSlugs } = input;

  // Mark job running
  await prisma.searchJob.update({
    where: { id: searchJobId },
    data: { status: 'running', startedAt: new Date() },
  });

  // Determine which retailers to query
  const retailers = await prisma.retailer.findMany({
    where: {
      isActive: true,
      ...(retailerSlugs?.length ? { slug: { in: retailerSlugs } } : {}),
    },
  });

  if (retailers.length === 0) {
    await prisma.searchJob.update({
      where: { id: searchJobId },
      data: { status: 'failed', completedAt: new Date() },
    });
    return;
  }

  // Instantiate shared browser — launched lazily only if an adapter falls back to Tier 3 Playwright
  const sharedBrowser = new SharedBrowser();

  const searchInput: SearchInput = { query, pincode, browser: sharedBrowser };
  const results = await Promise.allSettled(
    retailers.map(async (retailer) => {
      // Upsert scrape attempt record — guarantees max 1 attempt per retailer per search job
      const attempt = await prisma.scrapeAttempt.upsert({
        where: {
          searchJobId_retailerId: {
            searchJobId,
            retailerId: retailer.id,
          },
        },
        create: {
          searchJobId,
          retailerId: retailer.id,
          status: 'running',
          startedAt: new Date(),
        },
        update: {
          status: 'running',
          startedAt: new Date(),
          completedAt: null,
          errorCode: null,
          errorMessage: null,
        },
      });

      try {
        const adapter = getAdapter(retailer.slug as Parameters<typeof getAdapter>[0]);
        const offer = await adapter.search(searchInput);

        if (!offer) {
          await prisma.scrapeAttempt.update({
            where: { id: attempt.id },
            data: { status: 'no_match', completedAt: new Date() },
          });
          return;
        }

        // Parse medicine metadata from source title and fallback to search query for missing fields
        const parsedTitle = parseMedicineTitle(offer.sourceTitle ?? '');
        const parsedQuery = parseMedicineTitle(query);

        const parsed = {
          brandName: parsedTitle.brandName || parsedQuery.brandName || query,
          strengthValue: parsedTitle.strengthValue || parsedQuery.strengthValue,
          strengthUnit: parsedTitle.strengthUnit || parsedQuery.strengthUnit,
          dosageForm: parsedTitle.dosageForm || parsedQuery.dosageForm,
          packQuantity: parsedTitle.packQuantity || parsedQuery.packQuantity,
          packUnit: parsedTitle.packUnit || parsedQuery.packUnit,
        };

        // Find or create MedicineProduct matching display name
        let product = await prisma.medicineProduct.findFirst({
          where: { displayName: { equals: parsed.brandName, mode: 'insensitive' } },
        });

        if (!product) {
          try {
            product = await prisma.medicineProduct.create({
              data: {
                displayName: parsed.brandName,
                brandName: parsed.brandName,
                searchAliases: [parsed.brandName.toLowerCase()],
              },
            });
          } catch (error) {
            // In case of a concurrent create, fetch the existing one
            product = await prisma.medicineProduct.findFirst({
              where: { displayName: { equals: parsed.brandName, mode: 'insensitive' } },
            });
            if (!product) throw error;
          }
        }

        if (!product) {
          throw new Error(`Failed to resolve medicine product for "${parsed.brandName}"`);
        }

        // Generate normalized variant key
        const normalisedKey = buildNormalisedVariantKey({
          productId: product.id,
          strengthValue: parsed.strengthValue,
          strengthUnit: parsed.strengthUnit,
          dosageForm: parsed.dosageForm,
          packQuantity: parsed.packQuantity,
          packUnit: parsed.packUnit,
          manufacturerName: offer.manufacturerName,
        });

        // Find or create ProductVariant
        let variant = await prisma.productVariant.findUnique({
          where: { normalisedKey },
        });

        if (!variant) {
          try {
            variant = await prisma.productVariant.create({
              data: {
                medicineProductId: product.id,
                strengthValue: parsed.strengthValue,
                strengthUnit: parsed.strengthUnit,
                dosageForm: parsed.dosageForm,
                packQuantity: parsed.packQuantity,
                packUnit: parsed.packUnit,
                manufacturerName: offer.manufacturerName ?? null,
                normalisedKey,
                comparisonStatus: 'needs_review',
              },
            });
          } catch (error) {
            // Handle concurrent variant creation race condition gracefully
            variant = await prisma.productVariant.findUnique({
              where: { normalisedKey },
            });
            if (!variant) throw error;
          }
        }

        if (!variant) {
          throw new Error(`Failed to resolve product variant for key "${normalisedKey}"`);
        }

        // Set the search job's productVariantId if it hasn't been set yet
        const searchJob = await prisma.searchJob.findUnique({
          where: { id: searchJobId },
        });
        if (searchJob && !searchJob.productVariantId) {
          await prisma.searchJob.update({
            where: { id: searchJobId },
            data: { productVariantId: variant.id },
          });
        }

        const matchStatus = determineMatchStatus(query, offer.sourceTitle ?? query);

        // Upsert the retailer listing (sourceUrl is guaranteed non-null when offer is returned)
        const listing = await upsertRetailerListing(
          retailer.id,
          offer.sourceUrl ?? offer.sourceUrl!,
          offer.sourceTitle ?? query,
          variant.id,
          matchStatus,
        );

        // Write a price observation (always append, never overwrite)
        // Note: 'not_found' and 'searching' are only used for placeholder cards in the API; strip them here
        const prismaAvailability =
          offer.availability === 'not_found' || offer.availability === 'searching'
            ? 'unknown'
            : (offer.availability ?? 'unknown');
        await prisma.priceObservation.create({
          data: {
            retailerListingId: listing.id,
            scrapeAttemptId: attempt.id,
            locationKey: pincode ?? null,
            pricePaise: offer.pricePaise,
            mrpPaise: offer.mrpPaise,
            currency: 'INR',
            availability: prismaAvailability,
            tierUsed: offer.tierUsed ?? null,
            collectedAt: new Date(offer.collectedAt),
          },
        });

        await prisma.scrapeAttempt.update({
          where: { id: attempt.id },
          data: { status: 'succeeded', completedAt: new Date() },
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const code = message.includes('timeout') ? 'timed_out'
          : message.includes('rate') ? 'rate_limited'
          : 'failed';

        await prisma.scrapeAttempt.update({
          where: { id: attempt.id },
          data: {
            status: code as Prisma.ScrapeAttemptUpdateInput['status'],
            errorCode: code,
            errorMessage: message.slice(0, 500),
            completedAt: new Date(),
          },
        });
        throw error; // re-throw so Promise.allSettled captures as rejected
      }
    }),
  );

  // Close the shared browser asynchronously in the background so it doesn't block job completion
  void sharedBrowser.close().catch((err) => {
    console.error('[pipeline] Error closing shared browser:', err);
  });

  // Determine overall job status based on individual attempt results
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  let finalStatus: 'completed' | 'partial' | 'failed';
  if (succeeded === 0) {
    finalStatus = 'failed';
  } else if (failed > 0) {
    finalStatus = 'partial';
  } else {
    finalStatus = 'completed';
  }

  await prisma.searchJob.update({
    where: { id: searchJobId },
    data: { status: finalStatus, completedAt: new Date() },
  });
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function upsertRetailerListing(
  retailerId: string,
  rawUrl: string,
  sourceTitle: string,
  productVariantId: string,
  matchStatus: 'exact' | 'candidate' | 'needs_review' | 'rejected',
) {
  const url = canonicalUrl(rawUrl);

  const existing = await prisma.retailerListing.findFirst({
    where: { retailerId, canonicalUrl: url },
  });

  if (existing) {
    return prisma.retailerListing.update({
      where: { id: existing.id },
      data: {
        sourceTitle,
        productVariantId,
        matchStatus,
        lastVerifiedAt: new Date(),
      },
    });
  }

  return prisma.retailerListing.create({
    data: {
      retailerId,
      canonicalUrl: url,
      sourceTitle,
      productVariantId,
      matchStatus,
      lastVerifiedAt: new Date(),
    },
  });
}

/**
 * Strip trailing single-letter variant suffixes that are part of the product variant
 * but not the base brand (e.g. "Ovral L" -> "Ovral", "Ovral G" -> "Ovral").
 * This allows correct base-brand comparison without falsely equating variants.
 */
function stripVariantSuffix(brand: string): string {
  return brand.replace(/\s+[A-Z]$/i, '').trim();
}

/**
 * Dosage form groups that are mutually exclusive.
 * A result in a different group than the query is always rejected.
 */
const FORM_GROUPS: string[][] = [
  ['tablet', 'capsule', 'cap', 'softgel', 'lozenge', 'chewable'],
  ['syrup', 'suspension', 'solution', 'liquid', 'elixir', 'linctus', 'drops', 'drop'],
  ['cream', 'gel', 'ointment', 'lotion', 'paste', 'powder', 'toothpaste', 'foam', 'serum'],
  ['injection', 'infusion', 'vial', 'ampoule'],
  ['inhaler', 'rotacap', 'respule', 'nebuliser'],
  ['eye drop', 'ear drop', 'nasal spray', 'nasal drop'],
  ['sachet', 'granule'],
  ['patch', 'strip', 'plaster'],
];

function getFormGroup(form: string | null | undefined): number {
  if (!form) return -1;
  const f = form.toLowerCase();
  for (let i = 0; i < FORM_GROUPS.length; i++) {
    if (FORM_GROUPS[i]!.some((g) => f.includes(g))) return i;
  }
  return -1;
}

function determineMatchStatus(query: string, scrapedTitle: string): 'exact' | 'candidate' | 'needs_review' | 'rejected' {
  const queryParsed = parseMedicineTitle(query);
  const titleParsed = parseMedicineTitle(scrapedTitle);

  const cleanString = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const qBrandRaw = queryParsed.brandName;
  const sBrandRaw = titleParsed.brandName;
  const qBrand = cleanString(qBrandRaw);
  const sBrand = cleanString(sBrandRaw);

  // ── Hard dosage form mismatch → always reject ──────────────────────────────
  // e.g. query=tablet, scraped=toothpaste/syrup → completely different product
  const qFormGroup = getFormGroup(queryParsed.dosageForm);
  const sFormGroup = getFormGroup(titleParsed.dosageForm);
  if (qFormGroup !== -1 && sFormGroup !== -1 && qFormGroup !== sFormGroup) {
    return 'rejected';
  }

  // ── Base brand comparison (strip variant letters like "Ovral L" → "Ovral") ─
  const qBrandBase = cleanString(stripVariantSuffix(qBrandRaw));
  const sBrandBase = cleanString(stripVariantSuffix(sBrandRaw));

  // Same base brand but different variant letter (e.g. "Ovral L" vs "Ovral G")
  if (qBrandBase === sBrandBase && qBrand !== sBrand) {
    return 'needs_review';
  }

  // ── Strict brand matching — PREFIX or EXACT only, NOT substring ────────────
  // "quel" must not match inside "senquel" (suffix position = different brand)
  // Valid: sBrand starts with qBrand ("qutipin..." startsWith "qutipin")
  //        qBrand starts with sBrand ("augmentin500" startsWith "augmentin")
  // Invalid: "senquel".startsWith("quel") → false → rejected ✓
  const brandMatches =
    qBrand === sBrand ||
    sBrand.startsWith(qBrand) ||
    qBrand.startsWith(sBrand);

  if (!brandMatches) {
    return 'rejected';
  }

  // ── Strength and form matching ─────────────────────────────────────────────
  const strengthMatches =
    !queryParsed.strengthValue ||
    !titleParsed.strengthValue ||
    (queryParsed.strengthValue === titleParsed.strengthValue &&
      queryParsed.strengthUnit === titleParsed.strengthUnit);

  const formMatches =
    !queryParsed.dosageForm ||
    !titleParsed.dosageForm ||
    queryParsed.dosageForm === titleParsed.dosageForm;

  if (strengthMatches && formMatches) {
    return 'exact';
  }

  return 'needs_review';
}

