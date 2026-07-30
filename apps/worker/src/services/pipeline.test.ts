import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { runPipeline } from './pipeline.js';

describe('runPipeline Integration Test', () => {
  let retailerId = '';
  const testQuery = 'Dolo 650 tablet';
  let searchJobId = '';

  beforeAll(async () => {
    // Ensure we have the one-mg retailer seeded
    const retailer = await prisma.retailer.upsert({
      where: { slug: 'one-mg' },
      update: { isActive: true },
      create: {
        slug: 'one-mg',
        displayName: '1mg',
        integrationMode: 'browser_collection',
        isActive: true,
      },
    });
    retailerId = retailer.id;

    // Clean up any pre-existing Dolo test records
    await prisma.medicineProduct.deleteMany({
      where: { displayName: { equals: 'Dolo', mode: 'insensitive' } },
    });
  });

  afterAll(async () => {
    // Cleanup database records created during the test
    if (searchJobId) {
      await prisma.searchJob.deleteMany({
        where: { id: searchJobId },
      });
    }

    // Delete test medicine products and variants to keep database clean
    await prisma.medicineProduct.deleteMany({
      where: { displayName: { equals: 'Dolo', mode: 'insensitive' } },
    });
  });

  it('should run the search pipeline, mock scrapers, and persist all tables', async () => {
    // 1. Create a cold SearchJob
    const job = await prisma.searchJob.create({
      data: {
        query: testQuery,
        cacheKey: `q:dolo-650-integration-test-${Date.now()}`,
        status: 'queued',
      },
    });
    searchJobId = job.id;

    // 2. Run the pipeline (this uses the fixture fallback for 'one-mg' and 'Dolo 650 tablet')
    await runPipeline({
      searchJobId,
      query: testQuery,
      retailerSlugs: ['one-mg'],
    });

    // 3. Assert SearchJob was updated
    const updatedJob = await prisma.searchJob.findUnique({
      where: { id: searchJobId },
      include: {
        productVariant: true,
      },
    });

    expect(updatedJob).toBeDefined();
    expect(updatedJob?.status).toBe('completed');
    expect(updatedJob?.productVariantId).toBeDefined();

    // 4. Assert ScrapeAttempt was created and succeeded
    const attempts = await prisma.scrapeAttempt.findMany({
      where: { searchJobId },
    });
    expect(attempts.length).toBe(1);
    expect(attempts[0]).toBeDefined();
    expect(attempts[0]!.status).toBe('succeeded');
    expect(attempts[0]!.retailerId).toBe(retailerId);

    // 5. Assert MedicineProduct and Variant were created
    const product = await prisma.medicineProduct.findFirst({
      where: { displayName: { equals: 'Dolo', mode: 'insensitive' } },
      include: {
        variants: true,
      },
    });

    expect(product).toBeDefined();
    expect(product!.displayName).toBe('Dolo');
    expect(product!.variants.length).toBe(1);

    const variant = product!.variants[0];
    expect(variant).toBeDefined();
    expect(variant!.strengthValue).toBe('650');
    expect(variant!.strengthUnit).toBe('mg');
    expect(variant!.dosageForm).toBe('tablet');

    // 6. Assert RetailerListing was created and mapped to variant
    const listing = await prisma.retailerListing.findFirst({
      where: { retailerId, productVariantId: variant!.id },
    });
    expect(listing).toBeDefined();
    expect(listing!.matchStatus).toBe('exact');

    // 7. Assert PriceObservation was created with correct price
    const observations = await prisma.priceObservation.findMany({
      where: { retailerListingId: listing!.id },
    });
    expect(observations.length).toBe(1);
    expect(observations[0]).toBeDefined();
    expect(observations[0]!.pricePaise).toBe(3100);
    expect(observations[0]!.mrpPaise).toBe(3265);
  });
});
