export interface ParsedMedicine {
  brandName: string;
  strengthValue: string | null;
  strengthUnit: string | null;
  dosageForm: string | null;
  packQuantity: number | null;
  packUnit: string | null;
}

/**
 * Parses details (brand, strength, form, pack size) from a medicine title.
 */
export function parseMedicineTitle(title: string | null | undefined): ParsedMedicine {
  if (!title) {
    return {
      brandName: 'Unknown',
      strengthValue: null,
      strengthUnit: null,
      dosageForm: null,
      packQuantity: null,
      packUnit: null,
    };
  }
  // 1. Extract form: e.g. "Tablet", "Capsule", "Syrup", "Suspension", "Liquid", "Gel", "Injection", "Rotacap", "Respule", "Spray", etc.
  const formRegex = /\b(tablets?|capsules?|syrup|suspension|liquids?|solutions?|expectorant|elixir|injections?|gels?|cream|ointment|drops?|spray|sprays|inhaler|vials?|ampoules?|rotacaps?|respules?|pens?|sachets?|patches?|powders?)\b/i;
  const formMatch = title.match(formRegex);
  let dosageForm = formMatch && formMatch[1] ? formMatch[1].toLowerCase() : null;

  if (dosageForm) {
    if (dosageForm.endsWith('s') && !dosageForm.endsWith('ss')) {
      dosageForm = dosageForm.slice(0, -1);
    }
  }

  // 2. Extract strength: e.g. "650mg", "500 mg", "10mcg", "4000iu"
  // If form is syrup, liquid, cream, gel, ointment, drop, spray, volumes/weights like 100ml, 20g, 10ml are pack sizes, not active strength.
  const strengthRegex = /(\d+(?:\.\d+)?)\s*(mg|mcg|ui|iu)\b/i;
  let strengthMatch = title.match(strengthRegex);

  const isLiquidOrTopical = dosageForm && ['syrup', 'suspension', 'liquid', 'cream', 'gel', 'ointment', 'drop', 'spray'].includes(dosageForm);
  if (!strengthMatch && !isLiquidOrTopical) {
    const volumeStrengthRegex = /(\d+(?:\.\d+)?)\s*(g|ml|l)\b/i;
    strengthMatch = title.match(volumeStrengthRegex);
  }

  let strengthValue = strengthMatch && strengthMatch[1] ? strengthMatch[1] : null;
  let strengthUnit = strengthMatch && strengthMatch[2] ? strengthMatch[2].toLowerCase() : null;

  // 3. Extract pack quantity:
  let packQuantity: number | null = null;

  // A1. Explicit suffix count: "30's", "15's", "20s", "10s"
  const suffixRegex = /\b(\d+)\s*(?:'s|s)\b/i;
  const suffixMatch = title.match(suffixRegex);
  if (suffixMatch && suffixMatch[1]) {
    packQuantity = parseInt(suffixMatch[1], 10);
  }

  // A2. Explicit pack size phrases: "strip of 15 tablets", "pack of 10", "bottle of 400ml", "box of 200md", "tube of 30gm"
  if (!packQuantity) {
    const explicitPackRegex = /(?:strip|pack|box|bottle|tube|ampoule|vial|pen)\s+of\s+(\d+)\s*(?:'s|s|tablets?|capsules?|vials?|ampoules?|ml|g|gm|drops?|md|mdi|doses?|rotacaps?|respules?|pills?|units?)?/i;
    const explicitMatch = title.match(explicitPackRegex);
    if (explicitMatch && explicitMatch[1]) {
      packQuantity = parseInt(explicitMatch[1], 10);
    }
  }

  // B. Attached/spaced volume or weight numbers: "100gm", "50g", "400ml", "200md", "200 mdi", "30 rotacaps"
  if (!packQuantity) {
    const packRegex = /(?<!\.)\b(\d+)\s*(?:tablets?|capsules?|vials?|ampoules?|ml|g|gm|drops?|md|mdi|doses?|rotacaps?|respules?|pills?|units?)\b/i;
    const packMatch = title.match(packRegex);
    if (packMatch && packMatch[1]) {
      const parsedVal = parseInt(packMatch[1], 10);
      if (!strengthValue || parsedVal !== parseInt(strengthValue, 10)) {
        packQuantity = parsedVal;
      }
    }
  }

  // C. Fallback for attached quantity like "100gm", "50g", "400ml", "150ml"
  if (!packQuantity) {
    const attachedRegex = /(?<!\.)\b(\d+)(?:ml|g|gm|mg|md|mdi)\b/i;
    const attachedMatch = title.match(attachedRegex);
    if (attachedMatch && attachedMatch[1]) {
      const parsedVal = parseInt(attachedMatch[1], 10);
      if (!strengthValue || parsedVal !== parseInt(strengthValue, 10)) {
        packQuantity = parsedVal;
      }
    }
  }

  // D. Fallback for single trailing number
  if (dosageForm && !packQuantity) {
    const endNumberMatch = title.match(/\b(\d+)\b$/);
    if (endNumberMatch && endNumberMatch[1]) {
      packQuantity = parseInt(endNumberMatch[1], 10);
    }
  }

  // 4. Extract brand name
  let brandName = title;
  if (strengthMatch && strengthMatch.index !== undefined) {
    brandName = title.slice(0, strengthMatch.index).trim();
  } else if (formMatch && formMatch.index !== undefined) {
    brandName = title.slice(0, formMatch.index).trim();
  }

  brandName = brandName.replace(/[^a-zA-Z0-9\s-]/g, '').trim();

  if (!strengthValue && brandName) {
    const trailingNumMatch = brandName.match(/^(.*?)\s+(\d+(?:\.\d+)?)$/);
    if (trailingNumMatch && trailingNumMatch[1] && trailingNumMatch[2]) {
      brandName = trailingNumMatch[1].trim();
      strengthValue = trailingNumMatch[2];
      strengthUnit = ['syrup', 'suspension', 'liquid'].includes(dosageForm ?? '') ? 'ml' : 'mg';
      if (packQuantity === parseInt(strengthValue, 10)) {
        packQuantity = null;
      }
    }
  }

  if (!brandName) {
    brandName = title;
  }

  return {
    brandName,
    strengthValue,
    strengthUnit,
    dosageForm,
    packQuantity,
    packUnit: packQuantity ? 'units' : null,
  };
}
