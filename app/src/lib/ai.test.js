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
      "gemini-2.5-flash": {
        text: () => "not json",
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 },
      },
      "gemini-2.5-flash-lite": {
        text: () => '{"text":"HELLO","intent":"SEARCH"}',
        usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 5, totalTokenCount: 9 },
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
          model: "gemini-2.5-flash",
          source: "search",
          step: "generateContent",
          usage: {
            promptTokenCount: 1,
            candidatesTokenCount: 2,
            totalTokenCount: 3,
            cachedContentTokenCount: 0,
          },
        },
        {
          model: "gemini-2.5-flash-lite",
          source: "search",
          step: "generateContent",
          usage: {
            promptTokenCount: 4,
            candidatesTokenCount: 5,
            totalTokenCount: 9,
            cachedContentTokenCount: 0,
          },
        },
      ],
    });
    expect(result.aiModel).toBe("gemini-2.5-flash-lite");
  });

  it("propagates original error with errorContext when all models fail", async () => {
    const quotaError = Object.assign(new Error("RESOURCE_EXHAUSTED: quota exceeded"), { status: 429 });
    const { extractRegistrationFromAudio } = await buildModule({
      "gemini-2.5-flash": quotaError,
      "gemini-2.5-flash-lite": quotaError,
      "gemini-1.5-flash": quotaError,
    });
    await expect(extractRegistrationFromAudio("base64-audio", "audio/webm", false)).rejects.toMatchObject({
      message: "RESOURCE_EXHAUSTED: quota exceeded",
      errorContext: "audio-registration",
    });
  });
});
