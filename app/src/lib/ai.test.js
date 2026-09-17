/* global jest, describe, it, expect */
const buildModule = (responseByModel) => {
  jest.resetModules();
  jest.doMock("@google/generative-ai", () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn(({ model }) => ({
        generateContent: jest.fn(async () => {
          const response = responseByModel[model];

          if (response instanceof Error) {
            throw response;
          }

          return { response: Promise.resolve(response || responseByModel.default) };
        }),
      })),
    })),
  }));

  return import("./ai");
};

describe("AI extraction helpers", () => {
  it("returns parsed AI output plus aggregated token usage across fallback attempts", async () => {
    const { extractRegistrationFromAudio } = await buildModule({
      "gemini-2.0-flash": new Error("invalid json"),
      "gemini-1.5-flash": {
        text: () => '{"text":"HELLO","intent":"SEARCH"}',
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 7, totalTokenCount: 12 },
      },
    });
    const result = await extractRegistrationFromAudio("base64-audio", "audio/webm", false);

    expect(result).toMatchObject({
      text: "HELLO",
      intent: "SEARCH",
    });
    expect(result.tokenUsage).toEqual({
      promptTokenCount: 5,
      candidatesTokenCount: 7,
      totalTokenCount: 12,
      cachedContentTokenCount: 0,
      calls: [
        {
          model: "gemini-1.5-flash",
          source: "direct",
          step: "generateContent",
          usage: {
            promptTokenCount: 5,
            candidatesTokenCount: 7,
            totalTokenCount: 12,
            cachedContentTokenCount: 0,
          },
        },
      ],
    });
    expect(result.aiModel).toBe("gemini-1.5-flash");
  });

  it("propagates original error with errorContext when all models fail", async () => {
    const quotaError = Object.assign(new Error("RESOURCE_EXHAUSTED: quota exceeded"), { status: 429 });
    const { extractRegistrationFromAudio } = await buildModule({
      "gemini-2.0-flash": quotaError,
      "gemini-1.5-flash": quotaError,
    });
    await expect(extractRegistrationFromAudio("base64-audio", "audio/webm", false)).rejects.toMatchObject({
      message: "RESOURCE_EXHAUSTED: quota exceeded",
    });
  });

  it("returns a structured CRM interaction extracted from audio", async () => {
    const { extractCrmInteractionFromAudio } = await buildModule({
      "gemini-2.0-flash": {
        text: () => JSON.stringify({
          transcript: "Vamos enviar a proposta na próxima terça-feira.",
          summary: "Cliente pediu uma proposta.",
          nextContactAt: "2026-09-22T10:00:00-03:00",
          contactUpdates: { notesAppend: "Solicitou proposta comercial." },
          opportunities: [],
          tasks: [{ title: "Enviar proposta", summary: "Proposta comercial", dueAt: null }],
          equipmentLinks: [],
          confidence: 0.92,
        }),
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      },
    });

    const result = await extractCrmInteractionFromAudio("base64-audio", "audio/webm", {
      contactName: "Rafael",
      companyName: "Test",
    });

    expect(result).toMatchObject({
      transcript: "Vamos enviar a proposta na próxima terça-feira.",
      summary: "Cliente pediu uma proposta.",
      contactUpdates: { notesAppend: "Solicitou proposta comercial." },
      confidence: 0.92,
    });
  });
});
