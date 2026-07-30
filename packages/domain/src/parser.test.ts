import { describe, expect, it } from 'vitest';
import { parseMedicineTitle } from './parser.js';

describe('parseMedicineTitle', () => {
  it('should parse brand name, strength, dosage form, and pack size', () => {
    const parsed = parseMedicineTitle("Dolo 650mg Tablet 15's");
    expect(parsed).toEqual({
      brandName: 'Dolo',
      strengthValue: '650',
      strengthUnit: 'mg',
      dosageForm: 'tablet',
      packQuantity: 15,
      packUnit: 'units',
    });
  });

  it('should handle missing pack size', () => {
    const parsed = parseMedicineTitle("Crocin Advance 500mg Tablet");
    expect(parsed).toEqual({
      brandName: 'Crocin Advance',
      strengthValue: '500',
      strengthUnit: 'mg',
      dosageForm: 'tablet',
      packQuantity: null,
      packUnit: null,
    });
  });

  it('should parse capsule forms with pack size', () => {
    const parsed = parseMedicineTitle("Becosules Capsule 20's");
    expect(parsed).toEqual({
      brandName: 'Becosules',
      strengthValue: null,
      strengthUnit: null,
      dosageForm: 'capsule',
      packQuantity: 20,
      packUnit: 'units',
    });
  });

  it('should fallback gracefully for completely unparseable titles', () => {
    const parsed = parseMedicineTitle("Some Unknown Brand");
    expect(parsed).toEqual({
      brandName: 'Some Unknown Brand',
      strengthValue: null,
      strengthUnit: null,
      dosageForm: null,
      packQuantity: null,
      packUnit: null,
    });
  });

  it('should not parse decimal fractions as integer pack counts', () => {
    const parsed = parseMedicineTitle("Erythropoietin 4000iu 0.30ml Injection");
    expect(parsed.dosageForm).toBe('injection');
    expect(parsed.packQuantity).toBeNull();
  });

  it('should parse syrups and liquid volumes correctly', () => {
    const parsed = parseMedicineTitle("Benadryl Cough Syrup 100ml");
    expect(parsed.brandName).toContain('Benadryl');
    expect(parsed.dosageForm).toBe('syrup');
    expect(parsed.packQuantity).toBe(100);
    expect(parsed.packUnit).toBe('units');
  });

  it('should parse creams and ointments with weight in grams', () => {
    const parsed = parseMedicineTitle("Betnovate N Skin Cream 20g");
    expect(parsed.brandName).toContain('Betnovate');
    expect(parsed.dosageForm).toBe('cream');
    expect(parsed.packQuantity).toBe(20);
    expect(parsed.packUnit).toBe('units');
  });

  it('should parse rotacaps, sachets, and eye drops', () => {
    const rotacap = parseMedicineTitle("Foracort 200 Rotacap 30's");
    expect(rotacap.dosageForm).toBe('rotacap');
    expect(rotacap.packQuantity).toBe(30);

    expect(parseMedicineTitle("Eno Regular Sachet 5g").dosageForm).toBe('sachet');
    expect(parseMedicineTitle("Ciplox Eye Drops 10ml").dosageForm).toBe('drop');
  });
});
