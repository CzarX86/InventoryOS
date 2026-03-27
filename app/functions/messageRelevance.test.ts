import { MESSAGE_RELEVANCE_PROMPT } from "./messageRelevancePrompt";

describe("Message Relevance Prompt", () => {
  it("contains the expected classification categories", () => {
    expect(MESSAGE_RELEVANCE_PROMPT).toContain("COMMERCIAL");
    expect(MESSAGE_RELEVANCE_PROMPT).toContain("OPERATIONAL");
    expect(MESSAGE_RELEVANCE_PROMPT).toContain("PERSONAL");
    expect(MESSAGE_RELEVANCE_PROMPT).toContain("IRRELEVANT");
  });

  it("instructs for JSON output", () => {
    expect(MESSAGE_RELEVANCE_PROMPT).toContain("Return ONLY a JSON object");
    expect(MESSAGE_RELEVANCE_PROMPT).toContain('"relevance":');
  });
});
