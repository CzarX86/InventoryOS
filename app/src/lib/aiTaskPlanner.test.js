import { planAiTask, executeAiTask } from "./aiTaskPlanner";
import * as aiLayer from "./ai";
import * as aiRuns from "./aiRuns";

jest.mock("./ai", () => ({
  generateStructuredOutput: jest.fn(),
}));

jest.mock("./aiRuns", () => ({
  createAiRunRecord: jest.fn((data) => ({ ...data, id: "mock-id", type: "ai_run", status: "pending_approval" })),
  saveAiRun: jest.fn((data) => Promise.resolve({ ...data, id: "mock-id", type: "ai_run", status: "pending_approval" })),
  updateAiRun: jest.fn(() => Promise.resolve()),
}));

jest.mock("./modelRouter", () => ({
  routeTask: jest.fn(() => "gemini-2.0-flash"),
  getModelPricing: jest.fn(() => ({ inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 })),
}));

jest.mock("./firebase", () => ({
  db: {},
}));

const ownershipContext = {
  ownerId: "user-1",
  defaultAccountId: "acct-1",
};

describe("aiTaskPlanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("plans a task correctly with estimates", async () => {
    const plan = await planAiTask("extract_contact", "msg-123", {
      targetType: "message",
      estimatedInputTokens: 2000,
    }, ownershipContext);

    expect(plan).toEqual(expect.objectContaining({
      type: "ai_run",
      taskType: "extract_contact",
      targetType: "message",
      targetId: "msg-123",
      estimatedInputTokens: 2000,
      status: "pending_approval",
    }));
  });

  it("executes an approved task and returns result with usage", async () => {
    const plan = {
      id: "run-1",
      model: "gemini-2.0-flash",
      status: "approved",
      requiresApproval: true,
    };

    aiLayer.generateStructuredOutput.mockResolvedValue({
      output: { name: "Julio" },
      usage: { totalTokenCount: 150 },
      model: "gemini-2.0-flash",
    });

    const result = await executeAiTask(plan, "Extract name from body");

    expect(result.status).toBe("completed");
    expect(result.output).toEqual({ name: "Julio" });
    expect(result.actualUsage.totalTokenCount).toBe(150);
    expect(aiLayer.generateStructuredOutput).toHaveBeenCalledWith(
      "Extract name from body",
      "gemini-2.0-flash",
      [],
      expect.any(Object)
    );
  });

  it("fails to execute a pending approval task", async () => {
    const plan = {
      id: "run-2",
      status: "pending_approval",
      requiresApproval: true,
    };

    await expect(executeAiTask(plan, "some prompt")).rejects.toThrow("pending approval");
  });

  it("handles execution failures gracefully", async () => {
    const plan = {
      id: "run-3",
      status: "approved",
    };

    aiLayer.generateStructuredOutput.mockRejectedValue(new Error("API Down"));

    const result = await executeAiTask(plan, "some prompt");

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("API Down");
  });
});
