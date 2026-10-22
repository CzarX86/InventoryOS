/**
 * Pricing helpers for legacy inventory items.
 *
 * Items carry an optional `salePrice` (number, BRL), an optional
 * `priceSource` label, and an optional `priceReferences` list of
 * marketplace ads used to measure the price:
 * `[{ url, price, label }]`.
 *
 * All parsing/formatting lives here so the modals stay thin and the
 * logic is unit-testable. Firestore rules mirror these limits.
 */

export const MAX_PRICE_REFERENCES = 10;
export const MAX_PRICE_VALUE = 999999999;
const MAX_URL_LENGTH = 2000;
const MAX_LABEL_LENGTH = 120;
const MAX_SOURCE_LENGTH = 200;

function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Parses pt-BR or plain price input into a number, or null when empty.
 * Returns NaN when the input is filled but unparseable/negative.
 */
export function parsePriceInput(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return NaN;
    return value < 0 ? NaN : round2(value);
  }
  let text = String(value).trim();
  if (!text) return null;
  text = text.replace(/^R\$\s*/i, "").replace(/\s+/g, "");
  if (!text) return null;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  let normalized = text;
  if (hasComma && hasDot) {
    // "1.234,56" -> dots are thousands, comma is decimal.
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = text.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    // "1.234" typed the brazilian way -> 1234.
    normalized = text.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return NaN;
  return round2(parsed);
}

export function isValidHttpUrl(value) {
  const text = String(value || "").trim();
  if (!text || text.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Normalizes one reference row from the form into storable shape.
 * Returns { entry } or { error }.
 */
function normalizeReferenceRow(row, index) {
  const url = String(row?.url || "").trim();
  const label = String(row?.label || "").trim().slice(0, MAX_LABEL_LENGTH);
  const rawPrice = row?.price;
  const priceEmpty =
    rawPrice === null ||
    rawPrice === undefined ||
    String(rawPrice).trim() === "";
  const price = priceEmpty ? null : parsePriceInput(rawPrice);

  if (!url && price === null) return { entry: null };
  if (url && !isValidHttpUrl(url)) {
    return { error: `Link de anúncio inválido na referência ${index + 1}.` };
  }
  if (!priceEmpty && (price === null || Number.isNaN(price))) {
    return { error: `Preço inválido na referência ${index + 1}.` };
  }
  if (price !== null && price > MAX_PRICE_VALUE) {
    return { error: `Preço inválido na referência ${index + 1}.` };
  }
  const entry = { url, price };
  if (label) entry.label = label;
  return { entry };
}

/**
 * Normalizes form price fields into Firestore-ready values.
 * Never throws; reports the first problem in `error`.
 */
export function normalizePriceForSave(formData = {}) {
  const rawSale = formData?.salePrice;
  const saleEmpty =
    rawSale === null || rawSale === undefined || String(rawSale).trim() === "";
  const saleParsed = saleEmpty ? null : parsePriceInput(rawSale);
  if (!saleEmpty && (saleParsed === null || Number.isNaN(saleParsed))) {
    return emptyPriceResult("Preço de venda inválido. Use um valor como 1.234,56.");
  }
  if (saleParsed !== null && saleParsed > MAX_PRICE_VALUE) {
    return emptyPriceResult("Preço de venda inválido. Use um valor como 1.234,56.");
  }

  const priceSource = String(formData?.priceSource || "")
    .trim()
    .slice(0, MAX_SOURCE_LENGTH);

  const rawRefs = Array.isArray(formData?.priceReferences)
    ? formData.priceReferences
    : [];
  const priceReferences = [];
  for (let i = 0; i < Math.min(rawRefs.length, MAX_PRICE_REFERENCES); i += 1) {
    const { entry, error } = normalizeReferenceRow(rawRefs[i], i);
    if (error) return emptyPriceResult(error);
    if (entry) priceReferences.push(entry);
  }

  const salePrice = saleParsed;
  const hasPriceData =
    salePrice !== null || priceSource !== "" || priceReferences.length > 0;
  return { salePrice, priceSource, priceReferences, hasPriceData, error: null };
}

function emptyPriceResult(error) {
  return {
    salePrice: null,
    priceSource: "",
    priceReferences: [],
    hasPriceData: false,
    error,
  };
}

/** Mean of reference prices, or null when there are none. */
export function averageReferencePrice(references = []) {
  const prices = (Array.isArray(references) ? references : [])
    .map((ref) => ref?.price)
    .filter((price) => typeof price === "number" && Number.isFinite(price));
  if (prices.length === 0) return null;
  return round2(prices.reduce((sum, price) => sum + price, 0) / prices.length);
}

/** Formats a number as BRL, or null when missing. */
export function formatBRL(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(number);
}

/** Converts a stored item into AddItemModal form state. */
export function toPriceFormState(item = {}) {
  const refs = Array.isArray(item?.priceReferences) ? item.priceReferences : [];
  return {
    salePrice:
      item?.salePrice === null ||
      item?.salePrice === undefined ||
      item?.salePrice === ""
        ? ""
        : String(item.salePrice),
    priceSource: String(item?.priceSource || ""),
    priceReferences: refs.slice(0, MAX_PRICE_REFERENCES).map((ref) => ({
      url: String(ref?.url || ""),
      price:
        ref?.price === null || ref?.price === undefined ? "" : String(ref.price),
      label: String(ref?.label || ""),
    })),
  };
}
