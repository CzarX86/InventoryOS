export type ProductLookupMatch = "gtin" | "brand_part_number" | "brand_model";

export type ProductEnrichmentStatus = "enriched" | "not_found" | "skipped" | "error";

export interface ProductLookupInput {
  gtin?: unknown;
  brand?: unknown;
  model?: unknown;
  partNumber?: unknown;
  specifications?: unknown;
  type?: unknown;
  metadata?: Record<string, unknown> | null;
}
export interface ProductLookupCandidate {
  matchedBy: ProductLookupMatch;
  params: Record<string, string>;
}

export interface EnrichedProduct {
  productId: string | null;
  title: string | null;
  productName: string | null;
  brand: string | null;
  brandPartCode: string | null;
  gtins: string[];
  category: string | null;
  description: string | null;
  productUrl: string | null;
  datasheetUrl: string | null;
  manualUrl: string | null;
  specifications: Record<string, string>;
  sourceUrl: string;
  matchedBy: ProductLookupMatch;
}

export interface ProductLookupResult {
  status: ProductEnrichmentStatus;
  product: EnrichedProduct | null;
  matchedBy: ProductLookupMatch | null;
  sourceUrl: string | null;
  reason?: string;
}

type Fetcher = typeof fetch;

const OPEN_ICECAT_ENDPOINT = "https://live.icecat.biz/api";
const DEFAULT_ICECAT_SHOP = "openIcecat-live";
const DEFAULT_ICECAT_LANGUAGE = "PT";

function normalizeString(value: unknown) {
  return String(value || "").trim();
}

function normalizeToken(value: unknown) {
  return normalizeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function normalizeGtin(value: unknown) {
  const digits = normalizeString(value).replace(/\D/g, "");
  return /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(digits) ? digits : null;
}

export function buildProductLookupCandidates(input: ProductLookupInput = {}) {
  const candidates: ProductLookupCandidate[] = [];
  const seen = new Set<string>();
  const brand = normalizeString(input.brand);
  const partNumber = normalizeString(input.partNumber);
  const model = normalizeString(input.model);
  const gtins = [input.gtin, input.partNumber, input.model]
    .map(normalizeGtin)
    .filter((value): value is string => Boolean(value));

  const addCandidate = (matchedBy: ProductLookupMatch, params: Record<string, string>) => {
    const key = `${matchedBy}:${Object.entries(params).sort().map(([name, value]) => `${name}=${value}`).join("&")}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ matchedBy, params });
  };

  gtins.forEach((gtin) => addCandidate("gtin", { ean_upc: gtin }));

  if (brand && partNumber && !normalizeGtin(partNumber)) {
    addCandidate("brand_part_number", { Brand: brand, ProductCode: partNumber });
  }

  if (brand && model && !normalizeGtin(model) && normalizeToken(model) !== normalizeToken(partNumber)) {
    addCandidate("brand_model", { Brand: brand, ProductCode: model });
  }

  return candidates;
}

export function buildProductLookupSignature(input: ProductLookupInput = {}) {
  const values = [input.gtin, input.brand, input.model, input.partNumber].map(normalizeToken);
  if (!values.some(Boolean)) return "";
  return values.join("|");
}

function localizedValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeString(record.Value || record.value || record.Name || record.name);
  }
  return "";
}

function normalizeGtinList(value: unknown) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map(normalizeGtin)
    .filter((item): item is string => Boolean(item));
}

function parseSpecifications(featuresGroups: unknown) {
  const specifications: Record<string, string> = {};
  if (!Array.isArray(featuresGroups)) return specifications;

  featuresGroups.forEach((group) => {
    const groupRecord = (group || {}) as Record<string, any>;
    const groupName = localizedValue(groupRecord.FeatureGroup?.Name);
    const features = Array.isArray(groupRecord.Features) ? groupRecord.Features : [];

    features.forEach((feature: any) => {
      const name = localizedValue(feature?.Feature?.Name) || localizedValue(feature?.Name);
      const value = normalizeString(feature?.PresentationValue || feature?.Value || feature?.RawValue);
      const unit = normalizeString(feature?.Feature?.Measure?.Sign);
      if (!name || !value) return;

      const key = groupName && normalizeToken(groupName) !== normalizeToken(name)
        ? `${groupName} / ${name}`
        : name;
      specifications[key] = unit && !value.endsWith(unit) ? `${value} ${unit}` : value;
    });
  });

  return specifications;
}

export function parseOpenIcecatProduct(payload: any, sourceUrl: string, matchedBy: ProductLookupMatch): EnrichedProduct | null {
  const data = payload?.data || payload;
  const generalInfo = data?.GeneralInfo;
  if (!generalInfo || typeof generalInfo !== "object") return null;

  const description = generalInfo.Description || {};
  const productName = normalizeString(generalInfo.ProductName);
  const title = normalizeString(generalInfo.Title) || productName;
  const category = localizedValue(generalInfo.Category?.Name) || localizedValue(generalInfo.Category);

  return {
    productId: normalizeString(generalInfo.IcecatId) || null,
    title: title || null,
    productName: productName || null,
    brand: normalizeString(generalInfo.Brand) || null,
    brandPartCode: normalizeString(generalInfo.BrandPartCode) || null,
    gtins: normalizeGtinList(generalInfo.GTIN),
    category: category || null,
    description: normalizeString(description.LongDesc || description.ShortSummaryDescription) || null,
    productUrl: normalizeString(description.URL) || null,
    datasheetUrl: normalizeString(description.PDFURL || description.ProductInfoPDFURL || description.LeafletPDFURL) || null,
    manualUrl: normalizeString(description.ManualPDFURL) || null,
    specifications: parseSpecifications(data?.FeaturesGroups),
    sourceUrl,
    matchedBy,
  };
}

function buildOpenIcecatUrl(candidate: ProductLookupCandidate, config: { shopName?: string; language?: string } = {}) {
  const url = new URL(OPEN_ICECAT_ENDPOINT);
  url.searchParams.set("shopname", config.shopName || process.env.ICECAT_USERNAME || DEFAULT_ICECAT_SHOP);
  url.searchParams.set("lang", config.language || process.env.ICECAT_LANGUAGE || DEFAULT_ICECAT_LANGUAGE);
  Object.entries(candidate.params).forEach(([name, value]) => url.searchParams.set(name, value));
  return url.toString();
}

async function fetchWithTimeout(fetcher: Fetcher, url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Open Icecat returned HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function lookupOpenIcecatProduct(
  input: ProductLookupInput,
  fetcher: Fetcher = fetch,
  config: { shopName?: string; language?: string; timeoutMs?: number } = {},
): Promise<ProductLookupResult> {
  const candidates = buildProductLookupCandidates(input);
  if (candidates.length === 0) {
    return { status: "skipped", product: null, matchedBy: null, sourceUrl: null, reason: "missing_product_identifier" };
  }

  let lastUrl: string | null = null;
  for (const candidate of candidates) {
    const url = buildOpenIcecatUrl(candidate, config);
    lastUrl = url;
    try {
      const payload = await fetchWithTimeout(fetcher, url, config.timeoutMs || 8000);
      const product = parseOpenIcecatProduct(payload, url, candidate.matchedBy);
      if (product) {
        return { status: "enriched", product, matchedBy: candidate.matchedBy, sourceUrl: url };
      }
    } catch {
      // A later candidate may still resolve the product. The caller records the final outcome.
    }
  }

  return {
    status: "not_found",
    product: null,
    matchedBy: null,
    sourceUrl: lastUrl,
    reason: "product_not_found_in_open_icecat",
  };
}

function formatSpecifications(specifications: Record<string, string>) {
  return Object.entries(specifications)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");
}

export function buildEnrichmentPatch(input: ProductLookupInput, result: ProductLookupResult) {
  if (result.status !== "enriched" || !result.product) {
    return { fields: {}, confidence: null };
  }

  const product = result.product;
  const fields: Record<string, unknown> = {
    catalogProductName: product.productName || product.title,
    catalogDescription: product.description,
    catalogProductUrl: product.productUrl,
    catalogDatasheetUrl: product.datasheetUrl,
    catalogManualUrl: product.manualUrl,
    catalogSource: "open_icecat",
    technicalSpecifications: product.specifications,
  };

  if (!normalizeString(input.brand) && product.brand) fields.brand = product.brand;
  if (!normalizeString(input.model) && (product.productName || product.title)) fields.model = product.productName || product.title;
  if (!normalizeString(input.partNumber) && product.brandPartCode) fields.partNumber = product.brandPartCode;
  if (!normalizeString(input.gtin) && product.gtins[0]) fields.gtin = product.gtins[0];
  if (!normalizeString(input.type) && product.category) fields.type = product.category;
  if (!normalizeString(input.specifications)) {
    const formatted = formatSpecifications(product.specifications);
    if (formatted) fields.specifications = formatted;
  }

  const confidence = result.matchedBy === "gtin"
    ? 1
    : result.matchedBy === "brand_part_number"
      ? 0.98
      : 0.9;

  return { fields, confidence };
}
