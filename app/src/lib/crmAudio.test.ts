import {
  CRM_AUDIO_MAX_BYTES,
  getCrmAudioExtension,
  mergeCrmNotes,
  validateCrmAudio,
} from "./crmAudio";

describe("utilitários de áudio do CRM", () => {
  it("aceita formatos de áudio e rejeita arquivos grandes ou não-áudio", () => {
    expect(validateCrmAudio({ size: 1024, type: "audio/webm" })).toBeNull();
    expect(validateCrmAudio({ size: CRM_AUDIO_MAX_BYTES + 1, type: "audio/webm" })).toContain("15 MB");
    expect(validateCrmAudio({ size: 1024, type: "image/png" })).toContain("áudio");
  });

  it("resolve uma extensão segura para o arquivo salvo no Storage", () => {
    expect(getCrmAudioExtension("audio/webm", "ligacao.webm")).toBe("webm");
    expect(getCrmAudioExtension("audio/mpeg", "mensagem.mp3")).toBe("mp3");
    expect(getCrmAudioExtension("audio/unknown", "reuniao.ogg")).toBe("ogg");
    expect(getCrmAudioExtension("audio/unknown", "arquivo.sem-extensao")).toBe("audio");
  });

  it("acrescenta informações da IA sem apagar observações existentes", () => {
    expect(mergeCrmNotes("Cliente prefere contato por telefone.", "Solicitou proposta técnica.")).toBe(
      "Cliente prefere contato por telefone.\n\nSolicitou proposta técnica.",
    );
    expect(mergeCrmNotes("", "Solicitou proposta técnica.")).toBe("Solicitou proposta técnica.");
    expect(mergeCrmNotes("Observação", "")).toBe("Observação");
  });
});
