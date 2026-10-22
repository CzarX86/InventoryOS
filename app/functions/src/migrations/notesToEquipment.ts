export interface ParsedNoteEquipment {
  /** Equipment type text with the brand removed (e.g. "INVERSOR"). */
  equipmentType: string;
  /** Manufacturer matched from the known-brand list, or null when absent. */
  brand: string | null;
  /** Always null: legacy notes carry no reliable model information. */
  model: null;
}

/**
 * Manufacturers seen in industrial-automation notes, ordered so multi-word
 * names match before their single-word parts.
 */
const KNOWN_BRANDS = [
  "ALLEN BRADLEY",
  "MITSUBISHI",
  "SCHNEIDER",
  "SIEMENS",
  "FANUC",
  "DANFOSS",
  "YASKAWA",
  "BONFIGLIOLI",
  "ROCKWELL",
  "OMRON",
  "DELTA",
  "LENZE",
  "SEW",
  "WEG",
  "ABB",
  "VOGES",
  "EBERLE",
];

function escapeRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits a parsed note description such as `INVERSOR ALLEN BRADLEY`
 * into equipment type + brand. Returns null when no usable type remains
 * (e.g. the description is only a brand name).
 */
export function parseNoteEquipment(description: string | null | undefined): ParsedNoteEquipment | null {
  if (typeof description !== "string") return null;
  let remainder = description.trim().replace(/\s+/g, " ").toUpperCase();
  if (!remainder) return null;

  let brand: string | null = null;
  for (const candidate of KNOWN_BRANDS) {
    const pattern = new RegExp(`(^|[\\s/])${escapeRegExp(candidate)}(?=[\\s/]|$)`);
    if (pattern.test(remainder)) {
      brand = candidate;
      remainder = remainder.replace(pattern, " ").replace(/\s+/g, " ").trim();
      break;
    }
  }

  const equipmentType = remainder.replace(/\s*\/\s*/g, " ").replace(/\s+/g, " ").trim();
  if (!equipmentType) return null;
  return { equipmentType, brand, model: null };
}
