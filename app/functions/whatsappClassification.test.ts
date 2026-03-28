import { processPendingContactClassifications } from "./whatsappClassification";
import * as admin from "firebase-admin";

// Mocks
jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn((col) => ({
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn(() => ({
              empty: true,
              docs: []
            }))
          }))
        }))
      })),
      doc: jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        get: jest.fn(() => ({ 
          exists: true, 
          data: () => ({ lastMessageAt: { toMillis: () => 1000 } }) 
        }))
      }))
    })),
    batch: jest.fn(() => ({
      update: jest.fn(),
      set: jest.fn(),
      commit: jest.fn()
    }))
  })),
  FieldValue: {
    serverTimestamp: jest.fn(() => "mock-timestamp")
  }
}));

jest.mock("./aiTaskPlanner", () => ({
  planAiTask: jest.fn(() => Promise.resolve({ runId: "mock-run-id" })),
  executeAiTask: jest.fn(() => Promise.resolve({
    status: "completed",
    runId: "mock-run-id",
    output: {
      classification: "professional",
      confidence: 0.95,
      summary: "Hardware related discussion"
    }
  }))
}));

describe("whatsappClassification batch processor", () => {
  it("return count 0 if no pending contacts are found", async () => {
    const result = await processPendingContactClassifications();
    expect(result.count).toBe(0);
  });
});
