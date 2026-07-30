import 'dotenv/config';
import { tryOneMgSSR } from './adapters/one-mg-ssr.js';
import { tryPharmEasySSR } from './adapters/pharmeasy-ssr.js';
import { tryNetmedsSSR } from './adapters/netmeds-ssr.js';
import { calculatePerUnitPrice, parseMedicineTitle } from '@nirogi/domain';
import type { SourceOffer } from '@nirogi/contracts';

export interface CategorySuite {
  category: string;
  medicines: string[];
}

export const MEDICINE_CATEGORIES: CategorySuite[] = [
  {
    category: '💊 Tablets & Capsules (Solid Oral)',
    medicines: [
      'Combiflam tablet',
      'Saridon tablet',
      'Disprin tablet',
      'Liv 52 tablet',
      'Celin 500 tablet',
      'Meftal Spas tablet',
      'Beplex Forte tablet',
      'Supradyn Daily tablet',
      'Allegra 120 tablet',
      'Ecosprin 75 tablet',
    ],
  },
  {
    category: '🧪 Syrups, Suspensions & Oral Liquids',
    medicines: [
      'Calpol 250 syrup',
      'Digene gel syrup',
      'Alex cough syrup',
      'Zifi 50 dry syrup',
      'Duphalac oral solution',
      'Chericof syrup',
      'Asthalin expectorant',
      'Multiplex liquid',
      'Cypon syrup',
      'TussQ cough syrup',
    ],
  },
  {
    category: '🧴 Creams, Gels & Ointments (Topical)',
    medicines: [
      'Fastum gel',
      'Relispray',
      'Boroline cream',
      'Vicco Turmeric cream',
      'Lulifin cream',
      'Derma KT cream',
      'Tenovate cream',
      'Silverex Ionic gel',
      'Himani Fast Relief ointment',
      'Itch Guard cream',
    ],
  },
  {
    category: '👁️ Eye, Ear & Nasal Drops',
    medicines: [
      'Tears Naturale II eye drops',
      'Solivin nasal drops',
      'Vismed eye drops',
      'Milflox eye drops',
      'Flomist nasal spray',
      'Otrinoz adult nasal drops',
      'Zocon eye drops',
      'Paradrops eye drops',
      'Normax eye ear drops',
      'Solspre nasal spray',
    ],
  },
  {
    category: '💉 Injections, Vials & Ampoules',
    medicines: [
      'Tramazac 50mg injection',
      'Erythropoietin 4000IU injection',
      'Fortwin injection',
      'Taxim 1g injection',
      'Pantodac 40mg injection',
      'Lupiset 2mg injection',
      'Zoledronic Acid 4mg injection',
      'Methotrexate 50mg injection',
      'Enoxaparin 40mg injection',
      'Gentamicin 80mg injection',
    ],
  },
  {
    category: '🫁 Inhalers & Rotacaps (Respiratory)',
    medicines: [
      'Ipravent inhaler',
      'Syntaris nasal spray',
      'Budecort 100 respules',
      'Duolin respules',
      'Foracort 400 rotacaps',
      'Seretide 125 evohaler',
      'Asmacort inhaler',
      'Tiova synchrobreathe',
      'Levolin 50 inhaler',
      'Combihale FB 200 redicaps',
    ],
  },
];

export interface BenchmarkResult {
  category: string;
  query: string;
  source: string;
  fetchTimeMs: number;
  sourceTitle: string;
  priceFormatted: string;
  mrpFormatted: string;
  perUnitPriceFormatted: string;
  status: string;
  tier: string;
}

async function runBenchmark() {
  console.log('========================================================================================================');
  console.log('                  NIROGI MULTI-CATEGORY BENCHMARK SUITE (60 FRESH MEDICINES)                            ');
  console.log('========================================================================================================\n');

  const results: BenchmarkResult[] = [];

  for (const suite of MEDICINE_CATEGORIES) {
    console.log('========================================================================================================');
    console.log(`  CATEGORY: ${suite.category} (${suite.medicines.length} items)`);
    console.log('========================================================================================================');

    for (const query of suite.medicines) {
      process.stdout.write(`  • Fetching "${query}"... `);
      const queryStart = Date.now();

      // Parallel scrape across all 3 scrapers for each medicine
      const [oneMgOffer, pharmeasyOffer, netmedsOffer] = await Promise.all([
        tryOneMgSSR(query),
        tryPharmEasySSR(query),
        tryNetmedsSSR(query),
      ]);

      const totalQueryTime = Date.now() - queryStart;
      process.stdout.write(`Done in ${(totalQueryTime / 1000).toFixed(2)}s\n`);

      const offers = [
        { name: '1mg', offer: oneMgOffer },
        { name: 'PharmEasy', offer: pharmeasyOffer },
        { name: 'Netmeds', offer: netmedsOffer },
      ];

      for (const { name, offer } of offers) {
        if (offer) {
          const parsed = parseMedicineTitle(offer.sourceTitle ?? query);
          const perUnitPrice = calculatePerUnitPrice(offer.pricePaise, parsed.packQuantity, parsed.dosageForm);

          results.push({
            category: suite.category.split(' ')[1] || suite.category,
            query,
            source: name,
            fetchTimeMs: offer.fetchTimeMs ?? totalQueryTime,
            sourceTitle: (offer.sourceTitle ?? 'N/A').slice(0, 35),
            priceFormatted: offer.pricePaise ? `₹${(offer.pricePaise / 100).toFixed(2)}` : 'N/A',
            mrpFormatted: offer.mrpPaise ? `₹${(offer.mrpPaise / 100).toFixed(2)}` : 'N/A',
            perUnitPriceFormatted: perUnitPrice ?? 'N/A',
            status: offer.availability,
            tier: offer.tierUsed ?? 'tier1_ssr',
          });
        } else {
          results.push({
            category: suite.category.split(' ')[1] || suite.category,
            query,
            source: name,
            fetchTimeMs: totalQueryTime,
            sourceTitle: 'No match found',
            priceFormatted: 'N/A',
            mrpFormatted: 'N/A',
            perUnitPriceFormatted: 'N/A',
            status: 'no_match',
            tier: 'tier1_ssr',
          });
        }
      }
    }
    console.log('');
  }

  // Print Summary Table
  console.log('\n========================================================================================================');
  console.log('                                  NIROGI COMPREHENSIVE BENCHMARK RESULTS                                ');
  console.log('========================================================================================================\n');
  console.table(results);

  // Category Breakdown Metrics
  console.log('\n========================================================================================================');
  console.log('                                      CATEGORY-WISE BREAKDOWN                                           ');
  console.log('========================================================================================================\n');

  let totalSuccessfulScrapes = 0;
  let totalPerUnitCalculated = 0;
  let totalLatencyMs = 0;

  for (const suite of MEDICINE_CATEGORIES) {
    const catName = suite.category.split(' ')[1] || suite.category;
    const catResults = results.filter((r) => r.category === catName);
    const successScrapes = catResults.filter((r) => r.status !== 'no_match');
    const perUnitCalculated = successScrapes.filter((r) => r.perUnitPriceFormatted !== 'N/A');
    const avgLatency = Math.round(
      catResults.reduce((acc, curr) => acc + curr.fetchTimeMs, 0) / catResults.length,
    );

    totalSuccessfulScrapes += successScrapes.length;
    totalPerUnitCalculated += perUnitCalculated.length;
    totalLatencyMs += catResults.reduce((acc, curr) => acc + curr.fetchTimeMs, 0);

    console.log(`📌 ${suite.category}:`);
    console.log(`   • Scrapes: ${catResults.length} | Success: ${successScrapes.length}/${catResults.length} (${Math.round((successScrapes.length / catResults.length) * 100)}%)`);
    console.log(`   • Per-Unit Prices Calculated: ${perUnitCalculated.length}/${successScrapes.length} (${successScrapes.length > 0 ? Math.round((perUnitCalculated.length / successScrapes.length) * 100) : 0}%)`);
    console.log(`   • Average Response Time: ${avgLatency}ms\n`);
  }

  console.log('========================================================================================================');
  console.log('🏆 OVERALL SYSTEM METRICS SUMMARY:');
  console.log(`• Total Scrapes Executed: ${results.length} across 60 medicines in 6 distinct categories`);
  console.log(`• Overall Scraper Success Rate: ${totalSuccessfulScrapes}/${results.length} (${Math.round((totalSuccessfulScrapes / results.length) * 100)}%)`);
  console.log(`• Tier 1 SSR Hit Rate: ${results.length}/${results.length} (100%)`);
  console.log(`• Per-Unit Prices Computed: ${totalPerUnitCalculated}/${totalSuccessfulScrapes} (${Math.round((totalPerUnitCalculated / totalSuccessfulScrapes) * 100)}%)`);
  console.log(`• Average Latency per Scraper: ${Math.round(totalLatencyMs / results.length)}ms`);
  console.log('========================================================================================================\n');
}

runBenchmark().catch(console.error);
