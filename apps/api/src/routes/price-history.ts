import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const PriceHistoryParamsSchema = z.object({
  productVariantId: z.string().uuid(),
});

const PriceHistoryQuerySchema = z.object({
  days: z.coerce.number().int().positive().default(30),
});

export const priceHistoryRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /v1/products/:productVariantId/price-history?days=30
   *
   * Returns historical price observations for a given product variant.
   */
  app.get('/v1/products/:productVariantId/price-history', {
    schema: {
      tags: ['Products'],
      summary: 'Get historical price observations for a product variant',
      description: 'Returns time-series price data over a specified number of days for plotting price trends.',
      params: {
        type: 'object',
        properties: {
          productVariantId: { type: 'string', format: 'uuid', description: 'Product variant UUID' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', default: 30, description: 'Number of history days to fetch' },
        },
      },
    },
  }, async (request, reply) => {
    const { productVariantId } = PriceHistoryParamsSchema.parse(request.params);
    const { days } = PriceHistoryQuerySchema.parse(request.query);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Fetch the product variant details
    const variant = await prisma.productVariant.findUnique({
      where: { id: productVariantId },
      select: { packQuantity: true, dosageForm: true },
    });

    // Fetch listings for this variant
    const listings = await prisma.retailerListing.findMany({
      where: { productVariantId },
      select: { id: true, retailer: { select: { slug: true } } },
    });

    const listingIds = listings.map((l) => l.id);

    // Fetch price observations after cutoff
    const observations = await prisma.priceObservation.findMany({
      where: {
        retailerListingId: { in: listingIds },
        collectedAt: { gte: cutoff },
        pricePaise: { not: null },
      },
      orderBy: { collectedAt: 'asc' },
      select: {
        pricePaise: true,
        collectedAt: true,
        retailerListingId: true,
      },
    });

    // Map listing observations back to retailer slug
    const listingRetailerMap = new Map<string, string>();
    listings.forEach((l) => {
      listingRetailerMap.set(l.id, l.retailer.slug);
    });

    const formattedPoints = observations.map((obs) => {
      const priceRupees = obs.pricePaise! / 100;
      
      // Calculate raw unit price in rupees
      let unitPriceRupees = priceRupees;
      if (variant?.packQuantity && variant.packQuantity > 0) {
        const form = (variant.dosageForm ?? '').toLowerCase().trim();
        // Syrups/oral liquids: price per 5ml
        if (form.includes('syrup') || form.includes('suspension') || form.includes('liquid')) {
          unitPriceRupees = (priceRupees / variant.packQuantity) * 5;
        } else {
          // Tablets, capsules, injections, creams, drops, etc: price per single unit
          unitPriceRupees = priceRupees / variant.packQuantity;
        }
      }

      return {
        pricePaise: obs.pricePaise!,
        priceRupees,
        unitPriceRupees: Number(unitPriceRupees.toFixed(2)),
        collectedAt: obs.collectedAt.toISOString(),
        retailer: listingRetailerMap.get(obs.retailerListingId) || 'unknown',
      };
    });

    // If there are no data points, signal that data is insufficient
    const insufficientData = formattedPoints.length < 1;

    return reply.send({
      productVariantId,
      dosageForm: variant?.dosageForm || null,
      insufficientData,
      history: formattedPoints,
    });
  });
};
