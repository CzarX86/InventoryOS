import { getCrmAudioExtension, mergeCrmNotes, validateCrmAudio } from "./crmAudio";

describe("crmAudio", () => {
  it("validates audio type and gateway-compatible size", () => {
    expect(validateCrmAudio({ size: 10, type: "audio/mpeg" })).toBeNull();
    expect(validateCrmAudio({ size: 10, type: "image/png" })).toContain("áudio");
    expect(validateCrmAudio({ size: 6 * 1024 * 1024, type: "audio/mpeg" })).toContain("5 MB");
  });

  it("resolves safe extensions and merges notes", () => {
    expect(getCrmAudioExtension("audio/mpeg", "recording.bin")).toBe("mp3");
    expect(getCrmAudioExtension("audio/x-unknown", "recording.ogg")).toBe("ogg");
    expect(mergeCrmNotes("Contexto inicial", "Novo detalhe")).toBe("Contexto inicial\n\nNovo detalhe");
  });
});
