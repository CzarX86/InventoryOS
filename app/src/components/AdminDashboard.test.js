import { render, screen, fireEvent } from "@testing-library/react";
import AdminDashboard from "./AdminDashboard";

jest.mock("@/hooks/useFeatureFlags", () => jest.fn(() => ({
  flags: {
    contactReviewQueue: true,
    whatsappIngestion: false,
    actionInbox: false,
    hardwareIntelligence: false,
    txtImport: false,
    supplierRfq: false,
    semiAutonomousAi: false,
    teamHomeView: false,
  },
  enabledCount: 1,
  loading: false,
  error: null,
})));

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
    if (ref.collectionName === "ai_runs") {
      cb({
        docs: [
          {
            id: "ai-run-1",
            data: () => ({
              taskId: "ai-run-1",
              taskType: "contact_digest",
              provider: "deepseek",
              model: "deepseek-chat",
              totalTokenCount: 1080,
              estimatedCostUsd: 0.0142,
              usageCalls: [{}, {}, {}],
              targetType: "conversation",
              targetId: "conv-123",
              createdAt: { toDate: () => new Date("2026-01-02T10:00:00Z") },
            }),
          },
        ],
      });
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
    if (ref.collectionName === "module_requests") {
      cb({
        docs: [
          {
            id: "req-pending",
            data: () => ({
              module: "whatsapp",
              moduleLabel: "WhatsApp",
              status: "pending",
              message: "Preciso do WhatsApp liberado.",
              requesterName: "User One",
              requesterEmail: "user1@example.com",
            }),
          },
          {
            id: "req-approved",
            data: () => ({
              module: "whatsapp",
              moduleLabel: "WhatsApp",
              status: "approved",
              message: "Pedido antigo.",
              requesterName: "User Two",
              requesterEmail: "user2@example.com",
            }),
          },
        ],
      });
    }
    if (ref.collectionName === "system_audit_logs") {
      cb({
        docs: [
          {
            id: "audit-1",
            data: () => ({
              action: "BILLING_RECONCILED",
              category: "finops",
              actorId: "system",
              severity: "info",
              timestamp: { toDate: () => new Date("2026-01-03T10:00:00Z") },
            }),
          },
        ],
      });
    }
    return jest.fn();
  }),
}));

describe("AdminDashboard", () => {
  it("renders token usage and reversible activity for admins", async () => {
    render(<AdminDashboard items={[{ id: "item-123", status: "IN STOCK" }, { id: "item-456", status: "SOLD" }]} user={{ uid: "admin-1", email: "admin@example.com" }} />);

    expect(await screen.findByText("Uso de IA e custos")).toBeInTheDocument();
    expect(screen.getByText("Módulos e automações")).toBeInTheDocument();
    expect(screen.getByText(/1 de 11 recursos ativos/i)).toBeInTheDocument();
    expect(screen.getByText("contactReviewQueue")).toBeInTheDocument();
    expect(screen.getAllByText("Disabled").length).toBeGreaterThan(0);
    expect(screen.getByText("Itens disponíveis")).toBeInTheDocument();
    expect(screen.getByText("Itens vendidos")).toBeInTheDocument();
    expect(screen.getByText("1080")).toBeInTheDocument();
    expect(screen.getByText("US$ 0.0142")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Histórico da operação")).toBeInTheDocument();
    expect(screen.getByText("Erros para acompanhar")).toBeInTheDocument();
    expect(screen.getByText(/RESOURCE_EXHAUSTED/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rollback/i })).toBeInTheDocument();
  });

  it("shows honest health values instead of hardcoded Online/14ms", async () => {
    render(<AdminDashboard items={[]} user={{ uid: "admin-1", email: "admin@example.com" }} />);

    expect(await screen.findByText("Saúde técnica")).toBeInTheDocument();
    expect(screen.queryByText("Online")).not.toBeInTheDocument();
    expect(screen.queryByText("14ms")).not.toBeInTheDocument();
    expect(screen.getAllByText("não medido").length).toBeGreaterThanOrEqual(2);
  });

  it("shows module requests in pending and history tabs", async () => {
    render(<AdminDashboard items={[]} user={{ uid: "admin-1", email: "admin@example.com" }} />);

    expect(await screen.findByText("Solicitações de módulos")).toBeInTheDocument();
    expect(screen.getByText(/1 pendente/)).toBeInTheDocument();
    expect(screen.getByText("Preciso do WhatsApp liberado.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /histórico/i }));
    expect(screen.getByText("Pedido antigo.")).toBeInTheDocument();
  });

  it("exposes the system audit log for admins", async () => {
    render(<AdminDashboard items={[]} user={{ uid: "admin-1", email: "admin@example.com" }} />);

    expect(await screen.findByText("Trilha de auditoria")).toBeInTheDocument();
    expect(screen.getByText("BILLING_RECONCILED")).toBeInTheDocument();
  });
});
