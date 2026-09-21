import { createCrmReviewItemRecord } from "./crmReview";

describe("CRM AI review items", () => {
  it("creates a pending, workspace-scoped suggestion", () => {
    const record = createCrmReviewItemRecord({
      kind: "cross_sell",
      suggestion: { name: "Filtro compatível" },
      confidence: 0.91,
      sourceMessageIds: ["message-1"],
    }, {
      workspaceId: "workspace-1",
      defaultAccountId: "workspace-1",
      ownerId: "system",
    });

    expect(record).toMatchObject({
      type: "crm_review_item",
      workspaceId: "workspace-1",
      status: "pending",
      kind: "cross_sell",
      confidence: 0.91,
      sourceMessageIds: ["message-1"],
    });
  });
});
