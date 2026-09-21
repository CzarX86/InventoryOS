jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_options: any, handler: any) => ({ run: handler })),
}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(),
  Timestamp: { now: jest.fn(() => "timestamp") },
}));

import {
  buildBillingExportQuery,
  getBillingExportConfig,
  normalizeBillingRow,
  summarizeBillingRows,
} from "./billingReconciliation";

describe("Billing Export reconciliation", () => {
  it("normalizes gross cost and credits into an official net amount", () => {
    expect(normalizeBillingRow({
      usage_start_time: "2026-09-03T00:00:00Z",
      cost: "1.25",
      credits: [{ amount: "-0.25" }],
      currency: "USD",
      service: "Vertex AI",
      project_id: "inventory-os-app",
    })).toEqual({
      monthKey: "202609",
      service: "Vertex AI",
      currency: "USD",
      grossCostUsd: 1.25,
      creditsUsd: -0.25,
      officialCostUsd: 1,
      projectId: "inventory-os-app",
    });
  });

  it("groups rows by month and keeps the service and project lineage", () => {
    expect(summarizeBillingRows([
      { usage_start_time: "2026-08-02", cost: 1, credits: [], service: "Vertex AI", project_id: "prod" },
      { usage_start_time: "2026-08-09", cost: 2, credits: [{ amount: -0.5 }], service: "Gemini", project_id: "prod" },
      { usage_start_time: "2026-09-01", cost: 4, credits: [], service: "Vertex AI", project_id: "staging" },
    ])).toEqual([
      expect.objectContaining({ monthKey: "202608", officialCostUsd: 2.5, rowCount: 2, services: ["Vertex AI", "Gemini"] }),
      expect.objectContaining({ monthKey: "202609", officialCostUsd: 4, rowCount: 1, projectIds: ["staging"] }),
    ]);
  });

  it("only enables the reconciler when the complete table configuration exists", () => {
    expect(getBillingExportConfig({ BILLING_EXPORT_PROJECT_ID: "p", BILLING_EXPORT_DATASET: "d" })).toBeNull();
    expect(getBillingExportConfig({ BILLING_EXPORT_PROJECT_ID: "p", BILLING_EXPORT_DATASET: "d", BILLING_EXPORT_TABLE: "t", BILLING_EXPORT_LOCATION: "EU" })).toEqual({ projectId: "p", dataset: "d", table: "t", location: "EU" });
  });

  it("uses parameterized dates and restricts the query to AI services", () => {
    const query = buildBillingExportQuery({ projectId: "p", dataset: "d", table: "t" });
    expect(query).toContain("@from");
    expect(query).toContain("@to");
    expect(query).toContain("vertex ai");
  });
});
