import {
  appliedContactUpdates,
  describeAiStatus,
  formatAudioSize,
  formatConfidence,
  sortContactChannels,
} from "./crmTimeline";

describe("crmTimeline helpers (Step 2)", () => {
  it("formats audio sizes in pt-BR units", () => {
    expect(formatAudioSize(null)).toBeNull();
    expect(formatAudioSize(0)).toBeNull();
    expect(formatAudioSize(800)).toBe("800 B");
    expect(formatAudioSize(2048)).toBe("2 KB");
    expect(formatAudioSize(2.5 * 1024 * 1024)).toBe("2,5 MB");
  });

  it("formats model confidence as percent", () => {
    expect(formatConfidence(null)).toBeNull();
    expect(formatConfidence("x")).toBeNull();
    expect(formatConfidence(0.82)).toBe("82%");
    expect(formatConfidence(1)).toBe("100%");
  });

  it("lists only applied contact updates with pt-BR labels", () => {
    const applied = appliedContactUpdates({
      role: "Comprador",
      sector: null,
      locality: "  ",
      email: "a@b.com",
      phoneNumber: null,
      notesAppend: "prefere manhã",
    });
    expect(applied.map((item) => item.field)).toEqual([
      "role",
      "email",
      "notesAppend",
    ]);
    expect(applied[0].label).toBe("Função");
    expect(applied.find((item) => item.field === "notesAppend")?.label).toBe(
      "Observação anexada",
    );
  });

  it("returns empty list for missing updates", () => {
    expect(appliedContactUpdates(null)).toEqual([]);
    expect(appliedContactUpdates({})).toEqual([]);
  });

  it("describes AI status values", () => {
    expect(describeAiStatus("completed")).toBe("IA concluída");
    expect(describeAiStatus("processing")).toBe("IA processando");
    expect(describeAiStatus("failed")).toBe("IA falhou");
    expect(describeAiStatus(null)).toBeNull();
    expect(describeAiStatus("whatever")).toBeNull();
  });

  it("sorts primary channels first keeping stable order", () => {
    const channels = [
      { id: "b", isPrimary: false },
      { id: "a", isPrimary: true },
      { id: "c", isPrimary: false },
    ];
    expect(sortContactChannels(channels).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
