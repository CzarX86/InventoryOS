import { renderHook, act } from "@testing-library/react";
import useAIExtraction from "./useAIExtraction";
import { extractFromLabel } from "@/lib/ai";

// Mock the AI utility
jest.mock("@/lib/ai", () => ({
  extractFromLabel: jest.fn(),
}));

describe("useAIExtraction", () => {
  const mockFile = new File(["dummy content"], "label.png", { type: "image/png" });

  beforeEach(() => {
    jest.clearAllMocks();
    global.FileReader = class {
      readAsDataURL() {
        setTimeout(() => {
          this.result = "data:image/png;base64,mockBase64";
          this.onload({ target: { result: this.result } });
        }, 0);
      }
    };
  });

  it("should initialize with default states", () => {
    const { result } = renderHook(() => useAIExtraction());
    expect(result.current.loading).toBe(false);
    expect(result.current.suggestions).toBeNull();
    expect(result.current.hasPendingConfirmation).toBe(false);
  });

  it("should handle extraction and require confirmation (HIL)", async () => {
    const mockExtractedData = {
      type: "INVERSOR",
      brand: "WEG",
      model: "CFW500",
      partNumber: "123456",
      specifications: "380V"
    };
    extractFromLabel.mockResolvedValue(mockExtractedData);

    const { result } = renderHook(() => useAIExtraction());

    await act(async () => {
      await result.current.processExtraction(mockFile);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.suggestions).toEqual(mockExtractedData);
    expect(result.current.hasPendingConfirmation).toBe(true);
  });

  it("should clear suggestions on confirmation", async () => {
    const mockExtractedData = { type: "TEST" };
    extractFromLabel.mockResolvedValue(mockExtractedData);

    const { result } = renderHook(() => useAIExtraction());

    await act(async () => {
      await result.current.processExtraction(mockFile);
    });

    act(() => {
      result.current.confirmSuggestions();
    });

    expect(result.current.hasPendingConfirmation).toBe(false);
    expect(result.current.suggestions).toBeNull();
  });

  it("should emit token usage metadata without leaking it into suggestions", async () => {
    const mockExtractedData = {
      type: "INVERSOR",
      brand: "WEG",
      model: "CFW500",
      aiModel: "gemini-2.5-flash",
      tokenUsage: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
        cachedContentTokenCount: 0,
        calls: [{ model: "gemini", source: "direct", step: "generateContent", usage: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15, cachedContentTokenCount: 0 } }],
      },
      tokenUsageCalls: [],
    };
    const onUsage = jest.fn();
    extractFromLabel.mockResolvedValue(mockExtractedData);

    const { result } = renderHook(() => useAIExtraction({ onUsage }));

    await act(async () => {
      await result.current.processExtraction(mockFile);
    });

    expect(onUsage).toHaveBeenCalledWith(expect.objectContaining({
      tokenUsage: mockExtractedData.tokenUsage,
      source: "label-image",
      step: "processExtraction",
    }));
    expect(result.current.suggestions).toEqual({
      type: "INVERSOR",
      brand: "WEG",
      model: "CFW500",
    });
  });
});
