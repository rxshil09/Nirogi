import fs from 'fs';
import path from 'path';
import type { SourceOffer } from '@nirogi/contracts';

/**
 * Normalizes a query into a clean, hyphenated lowercase string suitable for fixture matching.
 * E.g., "Dolo 650 tablet" -> "dolo-650"
 */
export function getCleanQueryForFixture(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove punctuation except space and hyphen
    .replace(/\b(tablets?|capsules?|syrup|suspension|injections?|gels?|cream|ointment|drops|inhaler)\b/g, '') // Remove dosage form terms
    .trim()
    .replace(/\s+/g, '-'); // Replace whitespace with a single hyphen
}

/**
 * Checks for a local fixture matching the retailer and normalized query.
 * If found, returns the SourceOffer from the fixture. Otherwise returns null.
 */
export async function loadFixtureOffer(retailer: string, query: string): Promise<SourceOffer | null> {
  try {
    const cleanQuery = getCleanQueryForFixture(query);
    const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', `${retailer}-${cleanQuery}.json`);
    
    if (fs.existsSync(fixturePath)) {
      const raw = fs.readFileSync(fixturePath, 'utf8');
      const data = JSON.parse(raw);
      if (data && data.offer) {
        // Return the offer object from the fixture
        return {
          ...data.offer,
          collectedAt: new Date().toISOString(), // Use current time so it's fresh for tests/runs
        };
      }
    }
  } catch (error) {
    process.stderr.write(`[fixtures] Error loading fixture for ${retailer}/${query}: ${(error as Error).message}\n`);
  }
  return null;
}
