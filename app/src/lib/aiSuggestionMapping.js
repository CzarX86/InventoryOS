/**
 * Maps raw AI extraction suggestion keys onto inventory form fields.
 *
 * AI providers return free-form keys ("Brand", "EAN", "Technical Specs").
 * This normalizes them onto the form's field names so AddItemModal can merge
 * suggestions without knowing provider-specific key shapes.
 */

export const VALID_SUGGESTION_FIELDS = [
  "type",
  "brand",
  "model",
  "partNumber",
  "gtin",
  "specifications",
];

export function normalizeSuggestionKey(key) {
  let normalizedKey = String(key || "").toLowerCase();
  if (normalizedKey.includes("spec") || normalizedKey.includes("technical"))
    normalizedKey = "specifications";
  if (normalizedKey.includes("brand") || normalizedKey.includes("manufacturer"))
    normalizedKey = "brand";
  if (
    normalizedKey.includes("gtin") ||
    normalizedKey.includes("ean") ||
    normalizedKey.includes("upc") ||
    normalizedKey.includes("barcode")
  )
    normalizedKey = "gtin";
  return normalizedKey;
}

export function mapAiSuggestionsToFormFields(suggestions) {
  if (!suggestions || typeof suggestions !== "object") return {};
  return Object.keys(suggestions).reduce((acc, key) => {
    const normalizedKey = normalizeSuggestionKey(key);
    if (
      VALID_SUGGESTION_FIELDS.includes(normalizedKey) &&
      suggestions[key] !== null &&
      suggestions[key] !== undefined
    ) {
      acc[normalizedKey] = suggestions[key].toString().toUpperCase();
    }
    return acc;
  }, {});
}
