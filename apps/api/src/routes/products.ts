import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const ProductOffersParamsSchema = z.object({
  productVariantId: z.string().uuid(),
});

const ProductOffersQuerySchema = z.object({
  pincode: z.string().trim().regex(/^\d{6}$/).optional(),
});

export const productRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /v1/products/:productVariantId/offers?pincode=400001
   *
   * Returns the latest stored price observations for the given product variant.
   */
  app.get('/v1/products/:productVariantId/offers', async (request, reply) => {
    const { productVariantId } = ProductOffersParamsSchema.parse(request.params);
    const { pincode } = ProductOffersQuerySchema.parse(request.query);

    // Find the product variant to make sure it exists
    const variant = await prisma.productVariant.findUnique({
      where: { id: productVariantId },
    });

    if (!variant) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Product variant not found.',
      });
    }

    // Find all retailer listings linked to this variant
    const listings = await prisma.retailerListing.findMany({
      where: { productVariantId },
      include: {
        retailer: true,
      },
    });

    const results = [];

    // For each listing, get the most recent price observation
    for (const listing of listings) {
      const observation = await prisma.priceObservation.findFirst({
        where: {
          retailerListingId: listing.id,
          ...(pincode ? { locationKey: pincode } : {}),
        },
        orderBy: { collectedAt: 'desc' },
      });

      if (observation) {
        results.push({
          retailer: listing.retailer.slug,
          sourceTitle: listing.sourceTitle,
          sourceUrl: listing.canonicalUrl,
          pricePaise: observation.pricePaise,
          mrpPaise: observation.mrpPaise,
          discountPercent:
            observation.pricePaise != null && observation.mrpPaise != null && observation.mrpPaise > 0
              ? Math.round(((observation.mrpPaise - observation.pricePaise) / observation.mrpPaise) * 100)
              : null,
          availability: observation.availability,
          collectedAt: observation.collectedAt.toISOString(),
          matchStatus: listing.matchStatus === 'exact' ? 'exact' : 'candidate',
        });
      }
    }

    return reply.send({
      productVariantId,
      results,
    });
  });
};
