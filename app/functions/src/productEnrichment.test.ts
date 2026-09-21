import {
  buildEnrichmentPatch,
  buildProductLookupCandidates,
  buildProductLookupSignature,
  lookupOpenIcecatProduct,
  normalizeGtin,
  parseOpenIcecatProduct,
} from "./productEnrichment";

describe("product enrichment", () => {
  it("normalizes valid GTIN values and rejects arbitrary model codes", () => {
    expect(normalizeGtin("789.123.456-7890")).toBe("7891234567890");
    expect(normalizeGtin("SGM7J-04AFC6S")).toBeNull();
  });

  it("prioritizes GTIN and then manufacturer identifiers", () => {
    expect(buildProductLookupCandidates({
      gtin: "0882780751682",
      brand: "HP",
      model: "6710B",
      partNumber: "RJ459AV",
    })).toEqual([
      { matchedBy: "gtin", params: { ean_upc: "0882780751682" } },
      { matchedBy: "brand_part_number", params: { Brand: "HP", ProductCode: "RJ459AV" } },
      { matchedBy: "brand_model", params: { Brand: "HP", ProductCode: "6710B" } },
    ]);
  });

  it("creates a stable signature so enrichment does not loop on its own Firestore update", () => {
    expect(buildProductLookupSignature({
      brand: "HP",
      model: "6710B",
      partNumber: "RJ459AV",
    })).toBe("|HP|6710B|RJ459AV");
    expect(buildProductLookupSignature({ type: "Laptop" })).toBe("");
  });

  it("parses product identity and structured technical features", () => {
    const product = parseOpenIcecatProduct({
      data: {
        GeneralInfo: {
          IcecatId: 1198270,
          Title: "HP Compaq 6710b Base Model Notebook PC",
          ProductName: "Compaq 6710b Base Model Notebook PC",
          Brand: "HP",
          BrandPartCode: "RJ459AV",
          GTIN: ["0882780751682"],
          Category: { Name: { Value: "Laptops" } },
          Description: {
            LongDesc: "Notebook de teste",
            PDFURL: "https://example.test/datasheet.pdf",
          },
        },
        FeaturesGroups: [{
          FeatureGroup: { Name: { Value: "Processador" } },
          Features: [{
            Feature: { Name: { Value: "Frequência" }, Measure: { Sign: "GHz" } },
            PresentationValue: "2.0",
          }],
        }],
      },
    }, "https://example.test/icecat", "gtin");

    expect(product).toEqual(expect.objectContaining({
      productId: "1198270",
      brand: "HP",
      brandPartCode: "RJ459AV",
      category: "Laptops",
      datasheetUrl: "https://example.test/datasheet.pdf",
      matchedBy: "gtin",
    }));
    expect(product?.specifications).toEqual({ "Processador / Frequência": "2.0 GHz" });
  });

  it("automatically resolves the first successful free provider lookup", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          GeneralInfo: {
            IcecatId: 42,
            ProductName: "Compaq 6710b",
            Brand: "HP",
            BrandPartCode: "RJ459AV",
            GTIN: ["0882780751682"],
          },
          FeaturesGroups: [],
        },
      }),
    });

    const result = await lookupOpenIcecatProduct({
      gtin: "0882780751682",
      brand: "HP",
      model: "6710B",
      partNumber: "RJ459AV",
    }, fetcher, { shopName: "openIcecat-live" });

    expect(result.status).toBe("enriched");
    expect(result.matchedBy).toBe("gtin");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain("ean_upc=0882780751682");
  });

  it("does not overwrite manually entered values while enriching missing fields", () => {
    const result = {
      status: "enriched" as const,
      matchedBy: "brand_part_number" as const,
      sourceUrl: "https://example.test/icecat",
      product: {
        productId: "42",
        title: "HP Compaq 6710b",
        productName: "Compaq 6710b",
        brand: "HP",
        brandPartCode: "RJ459AV",
        gtins: ["0882780751682"],
        category: "Laptops",
        description: "Notebook",
        productUrl: null,
        datasheetUrl: null,
        manualUrl: null,
        specifications: { RAM: "4 GB" },
        sourceUrl: "https://example.test/icecat",
        matchedBy: "brand_part_number" as const,
      },
    };

    const patch = buildEnrichmentPatch({
      type: "Equipamento personalizado",
      brand: "Marca manual",
      model: "Modelo manual",
      specifications: "Especificação manual",
    }, result);

    expect(patch.fields).toEqual(expect.objectContaining({
      technicalSpecifications: { RAM: "4 GB" },
      catalogSource: "open_icecat",
    }));
    expect(patch.fields.brand).toBeUndefined();
    expect(patch.fields.model).toBeUndefined();
    expect(patch.fields.specifications).toBeUndefined();
    expect(patch.confidence).toBe(0.98);
  });
});
