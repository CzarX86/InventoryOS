import { render, screen } from "@testing-library/react";
import AdminDashboard from "./AdminDashboard";

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((db, name) => ({ collectionName: name })),
  query: jest.fn((ref) => ref),
  orderBy: jest.fn(),
  limit: jest.fn(),
  doc: jest.fn((db, name, id) => ({ collectionName: name, id })),
  onSnapshot: jest.fn((ref, cb) => {
    if (ref.collectionName === "telemetry") {
      cb({ docs: [] });
    }
    if (ref.collectionName === "task_ai_usage") {
      cb({
        docs: [
          {
            id: "task-1",
            data: () => ({
              taskId: "task-1",
              actorId: "user-1",
              taskType: "NEW_PRODUCT",
              source: "inventory-create",
              totalTokenCount: 42,
              promptTokenCount: 18,
              candidatesTokenCount: 24,
              calls: [{}, {}],
              itemId: "item-123",
              createdAt: { toDate: () => new Date("2026-01-01T10:00:00Z") },
            }),
          },
        ],
      });
    }
    if (ref.collectionName === "activity_log") {
      cb({
        docs: [
          {
            id: "activity-1",
            data: () => ({
              actionType: "CREATE_ITEM",
              actorId: "user-1",
              actorEmail: "admin@example.com",
              targetType: "inventory",
              targetId: "item-123",
              reversible: true,
              before: null,
              after: { model: "CFW500" },
              metadata: {},
              createdAt: { toDate: () => new Date("2026-01-01T10:00:00Z") },
            }),
          },
        ],
      });
    }
    if (ref.collectionName === "error_reports") {
      cb({
        docs: [
          {
            id: "ERR-20260319-AAAA",
            data: () => ({
              errorId: "ERR-20260319-AAAA",
              ticketId: "TKT-20260319-BBBB",
              action: "IMAGE_EXTRACTION",
              humanMessage: "A IA esta indisponivel no momento porque o limite de uso da API foi atingido.",
              knownReason: "O servico de IA ficou sem credito ou atingiu a cota configurada.",
              technicalMessage: "RESOURCE_EXHAUSTED",
              severity: "high",
              status: "open",
              adminNotified: true,
              userEmail: "user@example.com",
              createdAt: { toDate: () => new Date("2026-01-01T10:00:00Z") },
            }),
          },
        ],
      });
    }
    if (ref.collectionName === "system") {
      cb({ data: () => ({ totalAIRequests: 7 }) });
    }
    return jest.fn();
  }),
}));

describe("AdminDashboard", () => {
  it("renders token usage and reversible activity for admins", async () => {
    render(<AdminDashboard items={[{ id: "item-123", status: "IN STOCK", estimatedMarketValue: 10, sellingPrice: 20 }]} user={{ uid: "admin-1", email: "admin@example.com" }} />);

    expect(await screen.findByText("Token Usage")).toBeInTheDocument();
    expect(screen.getByText("42 tokens")).toBeInTheDocument();
    expect(screen.getByText("Activity History")).toBeInTheDocument();
    expect(screen.getByText("Support Inbox")).toBeInTheDocument();
    expect(screen.getByText(/RESOURCE_EXHAUSTED/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();
  });
});
