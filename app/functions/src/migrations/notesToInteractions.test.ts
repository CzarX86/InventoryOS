import { parseNoteInteraction } from "./notesToInteractions";

describe("parseNoteInteraction", () => {
  it("parses a proposal note with date, equipment and value", () => {
    expect(parseNoteInteraction("09/04/2025-PROPOSTA INVERSOR ALLEN BRADLEY 23.828,04")).toEqual({
      kind: "proposal",
      occurredAtIsoDate: "2025-04-09",
      description: "INVERSOR ALLEN BRADLEY",
      estimatedValue: 23828.04,
    });
  });

  it("parses a quotation note with spaced separators", () => {
    expect(parseNoteInteraction("28/04/2025 - COTAÇÃO SERVO MOTOR SCHNEIDER 4.756,03")).toEqual({
      kind: "quotation",
      occurredAtIsoDate: "2025-04-28",
      description: "SERVO MOTOR SCHNEIDER",
      estimatedValue: 4756.03,
    });
  });

  it("ignores a repeated date inside the note body", () => {
    expect(parseNoteInteraction("04/04/2025  PROPOSTA 04/04/2025 MEMBRANA/SENSOR 2.999,56")).toEqual({
      kind: "proposal",
      occurredAtIsoDate: "2025-04-04",
      description: "MEMBRANA/SENSOR",
      estimatedValue: 2999.56,
    });
  });

  it("returns null for notes without the proposal pattern", () => {
    expect(parseNoteInteraction("Ligar na segunda-feira de manhã")).toBeNull();
    expect(parseNoteInteraction("")).toBeNull();
    expect(parseNoteInteraction(null)).toBeNull();
  });

  it("returns null for invalid calendar dates", () => {
    expect(parseNoteInteraction("99/99/9999 PROPOSTA X 1.000,00")).toBeNull();
  });
});
