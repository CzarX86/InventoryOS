import { extractRegistrationFromAudio } from "./ai";

const responseByModel = {
  "gemini-2.5-flash": {
    text: () => "not json",
    usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 },
  },
  "gemini-2.5-flash-lite": {
    text: () => '{"text":"HELLO","intent":"SEARCH"}',
    usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 5, totalTokenCount: 9 },
  },
};

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn(({ model }) => ({
      generateContent: jest.fn(async () => ({
        response: Promise.resolve(responseByModel[model] || responseByModel["gemini-2.5-flash-lite"]),
      })),
    })),
  })),
}));

describe("AI extraction helpers", () => {
  it("returns parsed AI output plus aggregated token usage across fallback attempts", async () => {
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
});
