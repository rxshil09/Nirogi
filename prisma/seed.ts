/**
 * Seed script: creates the three retailer rows that adapters need.
 * Run once after `prisma migrate dev`:
 *   npx tsx --env-file=.env prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RETAILERS = [
  { slug: 'one-mg', displayName: '1mg', integrationMode: 'browser_collection' as const },
  { slug: 'netmeds', displayName: 'Netmeds', integrationMode: 'browser_collection' as const },
  { slug: 'pharmeasy', displayName: 'PharmEasy', integrationMode: 'browser_collection' as const },
] as const;

async function main() {
  for (const r of RETAILERS) {
    await prisma.retailer.upsert({
      where: { slug: r.slug },
      update: { displayName: r.displayName, isActive: true },
      create: {
        slug: r.slug,
        displayName: r.displayName,
        integrationMode: r.integrationMode,
        isActive: true,
      },
    });
    console.log(`✔ Upserted retailer: ${r.displayName}`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
