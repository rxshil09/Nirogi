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
export declare function parseMedicineTitle(title: string | null | undefined): ParsedMedicine;
