jest.mock("./firebase", () => ({
  db: {
    collection: jest.fn(),
    doc: jest.fn(),
  },
}));

import {
  AI_RUN_COLLECTIONS,
  AI_RUN_STATUSES,
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

describe("aiRuns helpers", () => {
  it("estimates AI run cost from pricing policy tokens", () => {
    const estimate = estimateAiRunCost({
      estimatedInputTokens: 12000,
      estimatedOutputTokens: 3000,
      estimatedCachedTokens: 6000,
      pricing: {
        inputUsdPer1M: 0.3,
        outputUsdPer1M: 2.5,
        cachedInputUsdPer1M: 0.075,
      },
    });

    expect(estimate).toEqual({
      estimatedInputTokens: 12000,
      estimatedOutputTokens: 3000,
      estimatedCachedTokens: 6000,
      estimatedTotalTokens: 21000,
      estimatedInputCostUsd: 0.0036,
      estimatedOutputCostUsd: 0.0075,
      estimatedCachedCostUsd: 0.00045,
      estimatedCostUsd: 0.01155,
    });
  });

  it("creates an ai_run record with ownership and estimated cost defaults", () => {
    const record = createAiRunRecord({
      taskType: "contact_digest",
      provider: "deepseek",
      model: "deepseek-chat",
      targetType: "conversation",
      targetId: "conv-1",
      estimatedInputTokens: 12000,
      estimatedOutputTokens: 3000,
      pricing: {
        inputUsdPer1M: 0.3,
        outputUsdPer1M: 2.5,
      },
    }, ownershipContext);

    expect(record).toEqual(expect.objectContaining({
      type: "ai_run",
      ownerId: "user-123",
      accountId: "acct_user-123",
      taskType: "contact_digest",
      status: "pending_approval",
      provider: "deepseek",
      model: "deepseek-chat",
      targetType: "conversation",
      targetId: "conv-1",
      requiresApproval: true,
      estimatedInputTokens: 12000,
      estimatedOutputTokens: 3000,
      estimatedTotalTokens: 15000,
      estimatedCostUsd: 0.0111,
      actualTotalTokenCount: 0,
      actualCostUsd: null,
    }));
  });

  it("creates policy, prompt template and style profile records for the AI operator layer", () => {
    const policy = createAiCostPolicyRecord({
      provider: "gemini",
      model: "gemini-2.5-flash",
      inputUsdPer1M: 0.3,
      outputUsdPer1M: 2.5,
    }, ownershipContext);
    const promptTemplate = createPromptTemplateRecord({
      taskType: "suggest_reactivation",
      version: 3,
      requiredContext: ["account_snapshot", "purchase_history"],
      toolAccess: ["getAccountSnapshot", "getCustomerPurchaseHistory"],
    }, ownershipContext);
    const styleProfile = createStyleProfileRecord({
      profileType: "seller",
      subjectId: "user-123",
      toneTraits: ["direct", "technical", "respectful"],
    }, ownershipContext);

    expect(AI_RUN_COLLECTIONS.aiRuns).toBe("ai_runs");
    expect(AI_RUN_STATUSES).toContain("completed");
    expect(policy).toEqual(expect.objectContaining({
      type: "ai_cost_policy",
      provider: "gemini",
      model: "gemini-2.5-flash",
      inputUsdPer1M: 0.3,
      outputUsdPer1M: 2.5,
    }));
    expect(promptTemplate).toEqual(expect.objectContaining({
      type: "prompt_template",
      taskType: "suggest_reactivation",
      version: 3,
      approvalPolicy: "approval_first",
    }));
    expect(styleProfile).toEqual(expect.objectContaining({
      type: "style_profile",
      profileType: "seller",
      subjectId: "user-123",
      toneTraits: ["direct", "technical", "respectful"],
    }));
  });
});
