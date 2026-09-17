import { normalizePhoneDigits, withoutBrazilCountryCode } from "./phone";

describe("function phone helpers", () => {
  it("uses the same canonical Brazilian phone format as the frontend", () => {
    expect(normalizePhoneDigits("(11) 99999-9999")).toBe("5511999999999");
    expect(normalizePhoneDigits("5511999999999")).toBe("5511999999999");
  });

  it("keeps a legacy local format available for existing contacts", () => {
    expect(withoutBrazilCountryCode("5511999999999")).toBe("11999999999");
  });
});
