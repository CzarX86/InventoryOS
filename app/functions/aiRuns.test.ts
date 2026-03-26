import {
  AI_RUN_COLLECTIONS,
  createAiCostPolicyRecord,
  createAiRunRecord,
  createPromptTemplateRecord,
  createStyleProfileRecord,
  estimateAiRunCost,
} from "./aiRuns";

const ownershipContext = {
  ownerId: "user-123",
  defaultAccountId: "acct_user-123",
};

describe("functions aiRuns helpers", () => {
  it("estimates cost and creates a record with ownership defaults", () => {
    const estimate = estimateAiRunCost({
      estimatedInputTokens: 10000,
      estimatedOutputTokens: 2000,
      pricing: {
        inputUsdPer1M: 0.25,
        outputUsdPer1M: 1.5,
      },
    });

    const record = createAiRunRecord({
      taskType: "history_backfill",
      provider: "gemini",
      model: "gemini-2.5-flash",
      estimatedInputTokens: 10000,
      estimatedOutputTokens: 2000,
      pricing: {
        inputUsdPer1M: 0.25,
        outputUsdPer1M: 1.5,
      },
    }, ownershipContext);

    expect(estimate.estimatedCostUsd).toBe(0.0055);
    expect(record).toEqual(expect.objectContaining({
      type: "ai_run",
      ownerId: "user-123",
      accountId: "acct_user-123",
      estimatedCostUsd: 0.0055,
      status: "pending_approval",
    }));
  });

  it("creates the AI operator support records", () => {
    const policy = createAiCostPolicyRecord({
      provider: "deepseek",
      model: "deepseek-chat",
      inputUsdPer1M: 0.2,
      outputUsdPer1M: 0.8,
    }, ownershipContext);
    const promptTemplate = createPromptTemplateRecord({
      taskType: "contact_review",
      requiredContext: ["conversation_summary"],
    }, ownershipContext);
    const styleProfile = createStyleProfileRecord({
      profileType: "contact",
      subjectId: "contact-123",
    }, ownershipContext);

    expect(AI_RUN_COLLECTIONS.promptTemplates).toBe("prompt_templates");
    expect(policy.type).toBe("ai_cost_policy");
    expect(promptTemplate.type).toBe("prompt_template");
    expect(styleProfile.type).toBe("style_profile");
  });
});
