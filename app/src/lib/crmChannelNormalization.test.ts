import {
  formatPhoneForDisplay,
  normalizeCorruptedPhoneLabel,
  normalizePhoneForStorage,
  phoneDigitsForStorage,
} from "./crmChannelNormalization";

describe("CRM phone storage and display", () => {
  it("stores recognized Brazilian numbers in E.164 without display punctuation", () => {
    expect(normalizePhoneForStorage("(47) 3301.8038")).toBe("+554733018038");
    expect(normalizePhoneForStorage("47/3301/8038")).toBe("+554733018038");
    expect(normalizePhoneForStorage("31 98744-5452")).toBe("+5531987445452");
    expect(normalizePhoneForStorage("+55 (47) 99988-7777")).toBe("+5547999887777");
  });

  it("keeps explicitly international numbers in E.164 form", () => {
    expect(normalizePhoneForStorage("+1 (415) 555-2671")).toBe("+14155552671");
  });

  it("preserves ambiguous text instead of discarding information", () => {
    expect(normalizePhoneForStorage("ramal 203")).toBe("ramal 203");
    expect(normalizePhoneForStorage("+55 (47) 3301")).toBe("+55 (47) 3301");
    expect(phoneDigitsForStorage("ramal 203")).toBe("");
  });

  it("keeps a digits-only matching value alongside the E.164 phone value", () => {
    expect(phoneDigitsForStorage("(31) 98744-5452")).toBe("5531987445452");
    expect(phoneDigitsForStorage("1234-5678")).toBe("12345678");
  });

  it("formats Brazilian mobiles and landlines for display", () => {
    expect(formatPhoneForDisplay("+5531987445452")).toBe("(31) 98744-5452");
    expect(formatPhoneForDisplay("+554733018038")).toBe("(47) 3301-8038");
  });

  it("does not guess a Brazilian mask for unsupported international numbers", () => {
    expect(formatPhoneForDisplay("+14155552671")).toBe("+14155552671");
    expect(formatPhoneForDisplay("+55 (47) 3301")).toBe("+55 (47) 3301");
  });

  it("repairs phone-shaped labels from the number and preserves legitimate custom labels", () => {
    expect(normalizeCorruptedPhoneLabel("24 2447.5118elular", "(24) 2447-5069")).toBe("Telefone");
    expect(normalizeCorruptedPhoneLabel("31 98744.5452", "+5531987445452")).toBe("Celular");
    expect(normalizeCorruptedPhoneLabel("Consultório", "+5531987445452")).toBe("Consultório");
    expect(normalizeCorruptedPhoneLabel("1234", "+5531987445452")).toBe("1234");
  });
});
