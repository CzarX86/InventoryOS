import { render, screen, fireEvent } from "@testing-library/react";
import AdminUsageStats from "./AdminUsageStats";

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

const usageDocData = { current: null };
const reconDocData = { current: null };

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((db, name, id) => ({ collectionName: name, id })),
  onSnapshot: jest.fn((ref, cb) => {
    if (ref.collectionName === "system_usage") {
      cb({
        exists: () => usageDocData.current != null,
        data: () => usageDocData.current,
      });
    }
    if (ref.collectionName === "system_billing_reconciliation") {
      cb({
        exists: () => reconDocData.current != null,
        data: () => reconDocData.current,
      });
    }
    return jest.fn();
  }),
}));

describe("AdminUsageStats", () => {
  beforeEach(() => {
    usageDocData.current = null;
    reconDocData.current = null;
  });

  it("shows an honest empty state when the monthly summary doc is missing", async () => {
    render(<AdminUsageStats />);

    expect(await screen.findByText(/sem dados medidos neste m/i)).toBeInTheDocument();
    expect(screen.queryByText(/US\$ 0\.000/)).not.toBeInTheDocument();
  });

  it("shows billing reconciliation detail instead of only the official number", async () => {
    usageDocData.current = {
      totalCostUsd: 1.5,
      totalRequests: 10,
      measuredRequests: 8,
      estimatedRequests: 2,
      officialCostUsd: 2.5,
      officialCostCurrency: "USD",
    };
    reconDocData.current = {
      monthKey: "202610",
      currency: "USD",
      grossCostUsd: 3,
      creditsUsd: -0.5,
      officialCostUsd: 2.5,
      rowCount: 2,
      services: ["Vertex AI", "Gemini"],
      projectIds: ["staging"],
    };
    render(<AdminUsageStats />);

    expect(await screen.findByText(/US\$ 2\.500/)).toBeInTheDocument();
    expect(screen.getByText(/Vertex AI/)).toBeInTheDocument();
    expect(screen.getByText(/2 linhas/)).toBeInTheDocument();
  });
});
