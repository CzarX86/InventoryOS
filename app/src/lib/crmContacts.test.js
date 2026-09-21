import { filterCompanySuggestions, normalizePhoneDigits } from "./crmContacts";

describe("crmContacts helpers", () => {
  it("only searches companies after the user types at least two characters", () => {
    const companies = [
      { id: "1", name: "Beta Máquinas" },
      { id: "2", name: "Alfa Industrial" },
      { id: "3", name: "Alfa Energia" },
    ];

    expect(filterCompanySuggestions(companies, "")).toEqual([]);
    expect(filterCompanySuggestions(companies, "a")).toEqual([]);
    expect(filterCompanySuggestions(companies, "alf").map((company) => company.id)).toEqual(["3", "2"]);
  });

  it("normalizes numbers for WhatsApp matching without changing the displayed value", () => {
    expect(normalizePhoneDigits("+55 (11) 99999-8888")).toBe("5511999998888");
  });
});
