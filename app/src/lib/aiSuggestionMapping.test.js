import {
  VALID_SUGGESTION_FIELDS,
  normalizeSuggestionKey,
  mapAiSuggestionsToFormFields,
} from "./aiSuggestionMapping";

describe("aiSuggestionMapping", () => {
  it("lists gtin as a valid suggestion field", () => {
    expect(VALID_SUGGESTION_FIELDS).toContain("gtin");
  });

  it("maps gtin identifiers and barcode aliases onto the gtin field", () => {
    expect(normalizeSuggestionKey("GTIN")).toBe("gtin");
    expect(normalizeSuggestionKey("EAN")).toBe("gtin");
    expect(normalizeSuggestionKey("upc_code")).toBe("gtin");
    expect(normalizeSuggestionKey("barcode")).toBe("gtin");
  });

  it("merges a gtin suggestion into form fields uppercased", () => {
    expect(
      mapAiSuggestionsToFormFields({ EAN: "7891234567890", brand: "Siemens" })
    ).toEqual({ gtin: "7891234567890", brand: "SIEMENS" });
  });

  it("keeps existing spec/brand alias behavior", () => {
    expect(
      mapAiSuggestionsToFormFields({
        "Technical Specs": "220V",
        manufacturer: "WEG",
      })
    ).toEqual({ specifications: "220V", brand: "WEG" });
  });

  it("ignores unknown keys and nullish values", () => {
    expect(
      mapAiSuggestionsToFormFields({
        somethingElse: "x",
        model: null,
        type: undefined,
      })
    ).toEqual({});
  });

  it("returns an empty object for missing suggestions", () => {
    expect(mapAiSuggestionsToFormFields(null)).toEqual({});
    expect(mapAiSuggestionsToFormFields(undefined)).toEqual({});
  });
});
