import { aggregateAiUsage } from "./finops";

// Mocking Firebase Admin and Firestore
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
}));

const mockSet = jest.fn();
jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: mockSet,
      })),
    })),
  })),
  FieldValue: {
    increment: jest.fn((val) => `inc(${val})`),
    serverTimestamp: jest.fn(() => "server_timestamp"),
  },
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
  },
}));

describe("FinOps Logic (Industrial Tests)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should skip aggregation if status is not completed", async () => {
    const event = {
      data: {
        after: { data: () => ({ status: "running" }) },
        before: { data: () => ({ status: "pending" }) }
      },
      params: { runId: "test-run" }
    };

    await (aggregateAiUsage as any).run(event);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("should skip if already completed previously to avoid double counting", async () => {
    const event = {
      data: {
        after: { data: () => ({ status: "completed" }) },
        before: { data: () => ({ status: "completed" }) }
      },
      params: { runId: "test-run" }
    };

    await (aggregateAiUsage as any).run(event);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("should aggregate correctly on first completion", async () => {
    const event = {
      data: {
        after: { 
          data: () => ({ 
            status: "completed", 
            actualCostUsd: 0.05, 
            actualTotalTokenCount: 1000,
            taskType: "extraction" 
          }) 
        },
        before: { data: () => ({ status: "running" }) }
      },
      params: { runId: "test-run" }
    };

    await (aggregateAiUsage as any).run(event);
    
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        totalCostUsd: "inc(0.05)",
        totalTokens: "inc(1000)",
        totalRequests: "inc(1)",
        lastRunId: "test-run"
      }),
      { merge: true }
    );
  });
});
