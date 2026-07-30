import { describe, expect, it } from 'vitest';
import { calculatePerUnitPrice, buildNormalisedVariantKey, normaliseManufacturerName } from './index.js';

describe('calculatePerUnitPrice', () => {
  it('should calculate tablet/capsule per unit price', () => {
    // ₹150 for 10 tablets -> ₹15.00 / unit
    expect(calculatePerUnitPrice(15000, 10, 'tablet')).toBe('₹15.00 / unit');
    expect(calculatePerUnitPrice(15000, 10, 'Capsule')).toBe('₹15.00 / unit');
    expect(calculatePerUnitPrice(15000, 10, 'powder')).toBe('₹15.00 / unit');
  });

  it('should calculate syrup/suspension price per 5ml', () => {
    // ₹100 for 100ml syrup -> (₹1 / ml) * 5ml = ₹5.00 / 5ml
    expect(calculatePerUnitPrice(10000, 100, 'syrup')).toBe('₹5.00 / 5ml');
    expect(calculatePerUnitPrice(10000, 100, 'Suspension')).toBe('₹5.00 / 5ml');
  });

  it('should calculate cream/ointment price per gram', () => {
    // ₹120 for 15g cream -> ₹8.00 / g
    expect(calculatePerUnitPrice(12000, 15, 'cream')).toBe('₹8.00 / g');
    expect(calculatePerUnitPrice(12000, 15, 'Ointment')).toBe('₹8.00 / g');
  });

  it('should calculate drops price per ml', () => {
    // ₹50 for 5ml drops -> ₹10.00 / ml
    expect(calculatePerUnitPrice(5000, 5, 'drops')).toBe('₹10.00 / ml');
  });

  it('should calculate injection price per ml', () => {
    // ₹300 for 2ml injection -> ₹150.00 / ml
    expect(calculatePerUnitPrice(30000, 2, 'injection')).toBe('₹150.00 / ml');
  });

  it('should calculate inhaler price per dose', () => {
    // ₹400 for 200 metered doses -> ₹2.00 / dose
    expect(calculatePerUnitPrice(40000, 200, 'inhaler')).toBe('₹2.00 / dose');
  });

  it('should fallback to unit/g/ml based on text matches if form is unknown', () => {
    expect(calculatePerUnitPrice(10000, 10, 'some-ml-form')).toBe('₹10.00 / ml');
    expect(calculatePerUnitPrice(10000, 10, 'some-g-form')).toBe('₹10.00 / g');
    expect(calculatePerUnitPrice(10000, 10, 'unknown')).toBe('₹10.00 / unit');
  });

  it('should return null if price or quantity are invalid', () => {
    expect(calculatePerUnitPrice(null, 10, 'tablet')).toBeNull();
    expect(calculatePerUnitPrice(15000, null, 'tablet')).toBeNull();
    expect(calculatePerUnitPrice(-100, 10, 'tablet')).toBeNull();
    expect(calculatePerUnitPrice(15000, 0, 'tablet')).toBeNull();
  });
});

describe('normaliseManufacturerName', () => {
  it('should canonicalise common Indian pharma brand variations to the same key', () => {
    expect(normaliseManufacturerName('Cipla Ltd')).toBe('cipla');
    expect(normaliseManufacturerName('Cipla Limited')).toBe('cipla');
    expect(normaliseManufacturerName('Mkt: Cipla Health')).toBe('cipla');

    expect(normaliseManufacturerName('Sun Pharmaceutical Industries Ltd')).toBe('sun pharma');
    expect(normaliseManufacturerName('Sun Pharma')).toBe('sun pharma');

    expect(normaliseManufacturerName("Dr. Reddy's Laboratories Ltd")).toBe('dr reddys');
    expect(normaliseManufacturerName('Dr Reddys Laboratories')).toBe('dr reddys');
  });

  it('should strip corporate legal suffixes and sanitize non-canonical names', () => {
    expect(normaliseManufacturerName('Biochem Pharmaceutical Industries')).toBe('biochem');
    expect(normaliseManufacturerName('Some Small Pharma Pvt Ltd')).toBe('some small');
  });

  it('should handle null or empty values gracefully', () => {
    expect(normaliseManufacturerName(null)).toBe('');
    expect(normaliseManufacturerName(undefined)).toBe('');
    expect(normaliseManufacturerName('')).toBe('');
  });
});

describe('buildNormalisedVariantKey', () => {
  it('should produce identical variant key for identical product with spelling variants of same manufacturer', () => {
    const key1 = buildNormalisedVariantKey({
      productId: 'prod-123',
      strengthValue: '500',
      strengthUnit: 'mg',
      dosageForm: 'tablet',
      packQuantity: 10,
      packUnit: 'units',
      manufacturerName: 'Cipla Ltd',
    });

    const key2 = buildNormalisedVariantKey({
      productId: 'prod-123',
      strengthValue: '500',
      strengthUnit: 'mg',
      dosageForm: 'tablet',
      packQuantity: 10,
      packUnit: 'units',
      manufacturerName: 'Cipla Limited',
    });

    expect(key1).toBe(key2);
    expect(key1).toBe('prod-123|500|mg|tablet|10|units|cipla');
  });

  it('should produce different variant keys for different manufacturers', () => {
    const keyCipla = buildNormalisedVariantKey({
      productId: 'prod-123',
      strengthValue: '500',
      strengthUnit: 'mg',
      dosageForm: 'tablet',
      packQuantity: 10,
      packUnit: 'units',
      manufacturerName: 'Cipla Ltd',
    });

    const keySun = buildNormalisedVariantKey({
      productId: 'prod-123',
      strengthValue: '500',
      strengthUnit: 'mg',
      dosageForm: 'tablet',
      packQuantity: 10,
      packUnit: 'units',
      manufacturerName: 'Sun Pharma',
    });

    expect(keyCipla).not.toBe(keySun);
  });
});
