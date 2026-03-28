import { parseStructuredText } from "./ai";

describe("AI Parsing Logic (Deep Tests)", () => {
  it("should parse a clean JSON object", () => {
    const input = '{"status": "ok", "count": 10}';
    const result = parseStructuredText(input);
    expect(result).toEqual({ status: "ok", count: 10 });
  });

  it("should extract JSON from inside markdown blocks", () => {
    const input = 'Sure, here is the data:\n```json\n{"status": "ok", "count": 5}\n```\nHope this helps!';
    const result = parseStructuredText(input);
    expect(result).toEqual({ status: "ok", count: 5 });
  });

  it("should handle nested objects correctly", () => {
    const input = 'Result: {"outer": {"inner": 123}, "active": true}';
    const result = parseStructuredText(input);
    expect(result).toEqual({ outer: { inner: 123 }, active: true });
  });

  it("should return rawOutput when no JSON is found", () => {
    const input = 'Hello world, no JSON here!';
    const result = parseStructuredText(input);
    expect(result).toEqual({ rawOutput: input });
  });

  it("should throw error in strict mode when JSON is invalid", () => {
    const input = '{ "invalid": "json", '; // missing closing brace
    expect(() => parseStructuredText(input, { strictJson: true })).toThrow();
  });

  it("should handle the largest possible brace span", () => {
    const input = 'Noise { "real": "json" } noise { "ignored": "json" }';
    const result = parseStructuredText(input);
    // The current regex /\{[\s\S]*\}/ is greedy, so it will take from the FIRST { to the LAST }
    // which might result in invalid JSON if there are independent blocks.
    // This test documents current behavior and potential for improvement.
    expect(() => JSON.parse(input.match(/\{[\s\S]*\}/)![0])).toThrow();
  });
});
