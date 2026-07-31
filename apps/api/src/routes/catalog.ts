import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const SuggestionsQuerySchema = z.object({
  q: z.string().trim().min(1).max(160),
});

export const catalogRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /v1/catalog/suggestions?q=paracetamol
   *
   * Returns matching medicine products from the Nirogi catalogue.
   * This endpoint ONLY queries the local database — it never invokes Playwright
   * or any external source. Suitable for autocomplete with debouncing on the client.
   */
  app.get('/v1/catalog/suggestions', {
    schema: {
      tags: ['Catalog'],
      summary: 'Medicine catalog autocomplete suggestions',
      description: 'Queries local database for matching medicine products, brands, and generics for instant autocomplete.',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', description: 'Search term or prefix', examples: ['Dolo'] },
        },
      },
    },
  }, async (request, reply) => {
    const { q } = SuggestionsQuerySchema.parse(request.query);

    const matches = await prisma.medicineProduct.findMany({
      where: {
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          { brandName: { contains: q, mode: 'insensitive' } },
          { genericName: { contains: q, mode: 'insensitive' } },
          { searchAliases: { has: q.toLowerCase() } },
        ],
      },
      select: {
        id: true,
        displayName: true,
        brandName: true,
        genericName: true,
        variants: {
          select: {
            id: true,
            strengthValue: true,
            strengthUnit: true,
            dosageForm: true,
            packQuantity: true,
            packUnit: true,
            manufacturerName: true,
          },
          take: 5,
        },
      },
      take: 10,
      orderBy: { displayName: 'asc' },
    });

    return reply.send({ suggestions: matches });
  });
};
