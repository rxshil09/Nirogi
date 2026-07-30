import 'dotenv/config';
import { chromium } from 'playwright';
import { OneMgAdapter } from './adapters/one-mg.js';
import { PharmEasyAdapter } from './adapters/pharmeasy.js';
import { NetmedsAdapter } from './adapters/netmeds.js';
import { calculatePerUnitPrice, parseMedicineTitle } from '@nirogi/domain';
import type { BenchmarkResult } from './batch-test.js';

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

async function runFullMultiTierBenchmark() {
  console.log('========================================================================================================');
  console.log('         NIROGI FULL MULTI-TIER BENCHMARK (TIER 1 SSR + TIER 2 SERPAPI/DB + TIER 3 PLAYWRIGHT)         ');
  console.log('========================================================================================================\n');

  const browser = await chromium.launch({ headless: true });

  const oneMg = new OneMgAdapter();
  const pharmEasy = new PharmEasyAdapter();
  const netmeds = new NetmedsAdapter();

  const results: any[] = [];

  try {
    for (const suite of MEDICINE_CATEGORIES) {
      console.log('========================================================================================================');
      console.log(`  CATEGORY: ${suite.category} (${suite.medicines.length} items)`);
      console.log('========================================================================================================');

      for (const query of suite.medicines) {
        console.log(`\n  • Scraper execution for "${query}":`);
        const queryStart = Date.now();

        const input = { query, pincode: '110001', browser };

        const oneMgOffer = await oneMg.search(input);
        const pharmeasyOffer = await pharmEasy.search(input);
        const netmedsOffer = await netmeds.search(input);

        const totalQueryTime = Date.now() - queryStart;

        const offers = [
          { name: '1mg', offer: oneMgOffer },
          { name: 'PharmEasy', offer: pharmeasyOffer },
          { name: 'Netmeds', offer: netmedsOffer },
        ];

        for (const { name, offer } of offers) {
          if (offer) {
            const parsed = parseMedicineTitle(offer.sourceTitle);
            const perUnitPrice = calculatePerUnitPrice(offer.pricePaise, parsed);

            results.push({
              category: suite.category.split(' ')[1] || suite.category,
              query,
              source: name,
              fetchTimeMs: offer.fetchTimeMs,
              sourceTitle: offer.sourceTitle.slice(0, 35),
              priceFormatted: offer.pricePaise ? `₹${(offer.pricePaise / 100).toFixed(2)}` : 'N/A',
              mrpFormatted: offer.mrpPaise ? `₹${(offer.mrpPaise / 100).toFixed(2)}` : 'N/A',
              perUnitPriceFormatted: perUnitPrice ? `${perUnitPrice.formattedRate} / ${perUnitPrice.unit}` : 'N/A',
              status: offer.availability,
              tier: offer.tierUsed,
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
              tier: 'failed',
            });
          }
        }
      }
      console.log('');
    }

    // Print Detailed Multi-Tier Table
    console.log('\n========================================================================================================');
    console.log('                             FULL MULTI-TIER SYSTEM BENCHMARK RESULTS                                   ');
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
    console.log('🏆 OVERALL MULTI-TIER SYSTEM METRICS SUMMARY:');
    console.log(`• Total Scrapes Executed: ${results.length} across 60 medicines in 6 distinct categories`);
    console.log(`• Overall Multi-Tier Scraper Success Rate: ${totalSuccessfulScrapes}/${results.length} (${Math.round((totalSuccessfulScrapes / results.length) * 100)}%)`);
    console.log(`• Per-Unit Prices Computed: ${totalPerUnitCalculated}/${totalSuccessfulScrapes} (${Math.round((totalPerUnitCalculated / totalSuccessfulScrapes) * 100)}%)`);
    console.log(`• Average Latency per Scraper: ${Math.round(totalLatencyMs / results.length)}ms`);
    console.log('========================================================================================================\n');
  } finally {
    await browser.close();
  }
}

runFullMultiTierBenchmark().catch(console.error);
