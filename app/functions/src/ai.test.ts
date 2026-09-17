jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn(() => ({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => '{"ok":true}',
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 1,
            totalTokenCount: 2,
          },
        },
      }),
    })),
  })),
}));

import { generateStructuredOutput } from "./ai";

describe("generateStructuredOutput", () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;

  afterEach(() => {
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiKey;

    if (originalDeepSeekKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
  });

  it("uses Gemini when DeepSeek is selected but not configured", async () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    delete process.env.DEEPSEEK_API_KEY;

    const result = await generateStructuredOutput("{}", "deepseek-chat");

    expect(result.model).toBe("gemini-2.0-flash");
    expect(result.output).toEqual({ ok: true });
  });
});
