import {
  MAX_PRICE_REFERENCES,
  averageReferencePrice,
  formatBRL,
  isValidHttpUrl,
  normalizePriceForSave,
  parsePriceInput,
  toPriceFormState,
} from "./inventoryPricing";

describe("parsePriceInput", () => {
  it("returns null for empty values", () => {
    expect(parsePriceInput(null)).toBeNull();
    expect(parsePriceInput(undefined)).toBeNull();
    expect(parsePriceInput("")).toBeNull();
    expect(parsePriceInput("   ")).toBeNull();
  });

  it("parses brazilian formatted values", () => {
    expect(parsePriceInput("1.234,56")).toBe(1234.56);
    expect(parsePriceInput("R$ 1.234,56")).toBe(1234.56);
    expect(parsePriceInput("99,90")).toBe(99.9);
    expect(parsePriceInput("100")).toBe(100);
  });

  it("parses plain numbers", () => {
    expect(parsePriceInput(250.5)).toBe(250.5);
    expect(parsePriceInput(0)).toBe(0);
  });

  it("flags negative and unparseable values as NaN", () => {
    expect(Number.isNaN(parsePriceInput("-10"))).toBe(true);
    expect(Number.isNaN(parsePriceInput("abc"))).toBe(true);
  });
});

describe("isValidHttpUrl", () => {
  it("accepts http and https links", () => {
    expect(
      isValidHttpUrl("https://produto.mercadolivre.com.br/MLB-123")
    ).toBe(true);
    expect(isValidHttpUrl("http://example.test/anuncio")).toBe(true);
  });

  it("rejects non-url text", () => {
    expect(isValidHttpUrl("")).toBe(false);
    expect(isValidHttpUrl("nao-e-link")).toBe(false);
    expect(isValidHttpUrl("ftp://example.test/x")).toBe(false);
  });
});

describe("normalizePriceForSave", () => {
  it("normalizes sale price and references", () => {
    const result = normalizePriceForSave({
      salePrice: "1.234,56",
      priceSource: " Mercado Livre ",
      priceReferences: [
        { url: "https://example.test/a", price: "1.000,00", label: "Anúncio A" },
        { url: "", price: "" },
      ],
    });

    expect(result.error).toBeNull();
    expect(result.salePrice).toBe(1234.56);
    expect(result.priceSource).toBe("Mercado Livre");
    expect(result.priceReferences).toEqual([
      { url: "https://example.test/a", price: 1000, label: "Anúncio A" },
    ]);
    expect(result.hasPriceData).toBe(true);
  });

  it("returns empty state when nothing was filled", () => {
    const result = normalizePriceForSave({
      salePrice: "",
      priceSource: "",
      priceReferences: [],
    });

    expect(result.error).toBeNull();
    expect(result.salePrice).toBeNull();
    expect(result.priceReferences).toEqual([]);
    expect(result.hasPriceData).toBe(false);
  });

  it("reports invalid sale price", () => {
    const result = normalizePriceForSave({ salePrice: "abc" });
    expect(result.salePrice).toBeNull();
    expect(result.error).toMatch(/preço/i);
  });

  it("reports invalid reference link", () => {
    const result = normalizePriceForSave({
      priceReferences: [{ url: "nao-e-link", price: "10" }],
    });
    expect(result.error).toMatch(/link/i);
  });

  it("caps references at the maximum", () => {
    const refs = Array.from({ length: MAX_PRICE_REFERENCES + 5 }, (_, i) => ({
      url: `https://example.test/${i}`,
      price: "10",
    }));
    const result = normalizePriceForSave({ priceReferences: refs });
    expect(result.error).toBeNull();
    expect(result.priceReferences).toHaveLength(MAX_PRICE_REFERENCES);
  });
});

describe("averageReferencePrice", () => {
  it("averages reference prices ignoring empty ones", () => {
    expect(
      averageReferencePrice([
        { url: "https://example.test/a", price: 100 },
        { url: "https://example.test/b", price: 200 },
        { url: "https://example.test/c", price: null },
      ])
    ).toBe(150);
  });

  it("returns null without prices", () => {
    expect(averageReferencePrice([])).toBeNull();
    expect(averageReferencePrice([{ url: "https://example.test/a" }])).toBeNull();
  });
});

describe("formatBRL", () => {
  it("formats values in BRL", () => {
    expect(formatBRL(1234.56)).toBe("R$\u00a01.234,56");
  });

  it("returns null for missing values", () => {
    expect(formatBRL(null)).toBeNull();
    expect(formatBRL(undefined)).toBeNull();
  });
});

describe("toPriceFormState", () => {
  it("converts stored values to form strings", () => {
    expect(
      toPriceFormState({
        salePrice: 1234.56,
        priceSource: "ML",
        priceReferences: [{ url: "https://example.test/a", price: 1000 }],
      })
    ).toEqual({
      salePrice: "1234.56",
      priceSource: "ML",
      priceReferences: [{ url: "https://example.test/a", price: "1000", label: "" }],
    });
  });

  it("returns blank state for items without price", () => {
    expect(toPriceFormState({})).toEqual({
      salePrice: "",
      priceSource: "",
      priceReferences: [],
    });
  });
});
