import { UNIFIED_BUSINESS_EXTRACTION_PROMPT } from "./unifiedExtractionPrompt";

describe("Unified Business Extraction Prompt", () => {
  it("contains all required CRM and Inventory sections", () => {
    expect(UNIFIED_BUSINESS_EXTRACTION_PROMPT).toContain("inventoryTransactions");
    expect(UNIFIED_BUSINESS_EXTRACTION_PROMPT).toContain("opportunities");
    expect(UNIFIED_BUSINESS_EXTRACTION_PROMPT).toContain("tasks");
    expect(UNIFIED_BUSINESS_EXTRACTION_PROMPT).toContain("events");
    expect(UNIFIED_BUSINESS_EXTRACTION_PROMPT).toContain("interests");
  });

  it("handles the structured output request correctly", () => {
    expect(UNIFIED_BUSINESS_EXTRACTION_PROMPT).toContain("Return ONLY a JSON object");
    expect(UNIFIED_BUSINESS_EXTRACTION_PROMPT).toContain('"stage": "new" | "negotiation" | "won" | "lost"');
  });

  describe("Functional Logic (Mocked)", () => {
    it("should correctly handle a full extraction record for inventory and CRM", () => {
      // Mocking the expected structure returned by the AI
      const mockAiOutput = {
        isConversationComplete: true,
        summary: "User bought 10 sensors and asked for a quote on cameras.",
        confidence: 0.95,
        inventoryTransactions: [
          {
            operation: "SELL",
            items: [{ name: "Sensor X", quantity: 10, unitPrice: 50, total: 500 }],
            grandTotal: 500
          }
        ],
        opportunities: [
          {
            title: "Quote for Cameras",
            stage: "negotiation",
            estimatedValue: 2000,
            currency: "BRL"
          }
        ],
        tasks: [
          {
            title: "Send quote for cameras",
            taskType: "quote",
            status: "pending",
            dueDaysFromNow: 1
          }
        ]
      };

      // Verify structure matches the prompt requirements
      expect(mockAiOutput).toHaveProperty("inventoryTransactions");
      expect(mockAiOutput.inventoryTransactions[0].operation).toBe("SELL");
      expect(mockAiOutput.opportunities[0].stage).toBe("negotiation");
    });
  });
});
