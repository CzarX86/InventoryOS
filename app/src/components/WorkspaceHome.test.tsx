import { fireEvent, render, screen } from "@testing-library/react";
import WorkspaceHome, { buildHomeMetrics } from "./WorkspaceHome";

const mockGetWorkspaceHomeSnapshot = jest.fn();
const mockOnSnapshot = jest.fn();
const mockOpenCrm = jest.fn();

jest.mock("@/lib/firebase", () => ({ db: { name: "test-db" } }));
jest.mock("@/lib/crmHomeApi", () => ({
  getWorkspaceHomeSnapshot: (...args: unknown[]) => mockGetWorkspaceHomeSnapshot(...args),
}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn((...args: unknown[]) => args),
  limit: jest.fn((value: number) => value),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn((...args: unknown[]) => args),
}));

describe("buildHomeMetrics", () => {
  it("keeps the employee home metrics limited to the last seven days", () => {
    const now = new Date(2026, 8, 17, 12, 0, 0).getTime();
    const day = 24 * 60 * 60 * 1000;
    const metrics = buildHomeMetrics([
      {
        id: "today",
        eventType: "contact_interaction",
        contactId: "contact-1",
        occurredAt: now - (2 * 60 * 60 * 1000),
        nextContactAt: now + (2 * 60 * 60 * 1000),
      },
      {
        id: "week",
        eventType: "contact_interaction",
        contactId: "contact-2",
        occurredAt: now - (3 * day),
      },
      {
        id: "old",
        eventType: "contact_interaction",
        contactId: "contact-old",
        occurredAt: now - (8 * day),
      },
      {
        id: "milestone",
        eventType: "opportunity_created",
        contactId: "contact-ignored",
        occurredAt: now,
      },
    ], now);

    expect(metrics.todayEvents.map((event) => event.id)).toEqual(["today"]);
    expect(metrics.contactsReached).toBe(2);
    expect(metrics.scheduledFollowUps).toBe(1);
    expect(metrics.dailyCounts).toHaveLength(7);
    expect(metrics.dailyCounts.reduce((total, dayPoint) => total + dayPoint.count, 0)).toBe(2);
  });
});

describe("WorkspaceHome team view", () => {
  const adminUser = {
    uid: "admin-1",
    displayName: "Ana Admin",
    workspaceId: "workspace-1",
  };
  const employee = {
    uid: "employee-2",
    displayName: "Bruno",
    workspaceId: "workspace-1",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWorkspaceHomeSnapshot.mockResolvedValue({
      employees: [employee],
      events: [{
        id: "admin-event",
        eventType: "contact_interaction",
        actorUserId: adminUser.uid,
        summary: "Atividade da Ana",
        occurredAt: new Date(),
      }],
      eventLimitReached: false,
    });
    mockOnSnapshot.mockImplementation((_query, onNext) => {
      onNext({ docs: [] });
      return jest.fn();
    });
  });

  it("lets an authorized admin view an approved teammate in read-only mode", async () => {
    render(<WorkspaceHome user={adminUser} canViewTeam inventoryCount={12} onOpenCrm={mockOpenCrm} />);

    const selector = await screen.findByRole("combobox", { name: "Ver painel de" });
    expect(selector).toHaveValue(adminUser.uid);
    expect(mockGetWorkspaceHomeSnapshot).toHaveBeenCalledWith(adminUser.uid);
    expect(await screen.findByRole("option", { name: "Bruno" })).toBeInTheDocument();

    mockGetWorkspaceHomeSnapshot.mockResolvedValueOnce({
      employees: [employee],
      events: [{
        id: "employee-event",
        eventType: "contact_interaction",
        actorUserId: employee.uid,
        summary: "Retorno do cliente X",
        occurredAt: new Date(),
      }],
      eventLimitReached: false,
    });
    fireEvent.change(selector, { target: { value: employee.uid } });

    expect(await screen.findByRole("heading", { name: "Olá, Bruno." })).toBeInTheDocument();
    expect(await screen.findByText("Visualização somente leitura")).toBeInTheDocument();
    const registerInteraction = screen.getByRole("button", { name: "Registrar interação" });
    expect(registerInteraction).toBeDisabled();
    fireEvent.click(registerInteraction);
    expect(mockOpenCrm).not.toHaveBeenCalled();
    expect(screen.getByText("Retorno do cliente X")).toBeInTheDocument();
    expect(mockGetWorkspaceHomeSnapshot).toHaveBeenLastCalledWith(employee.uid);
  });

  it("does not expose the teammate selector to a regular user", async () => {
    mockOnSnapshot.mockImplementation((_query, onNext) => {
      onNext({ docs: [{ id: "personal", data: () => ({
        eventType: "contact_interaction",
        actorUserId: "employee-2",
        summary: "Atividade pessoal",
        occurredAt: new Date(),
      }) }] });
      return jest.fn();
    });

    render(<WorkspaceHome user={employee} onOpenCrm={mockOpenCrm} />);

    expect(await screen.findByText("Atividade pessoal")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Ver painel de" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar interação" })).toBeEnabled();
  });

  it("shows a recoverable error and reloads the selected user's view", async () => {
    mockGetWorkspaceHomeSnapshot
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({
        employees: [employee],
        events: [{
          id: "recovered-event",
          eventType: "contact_interaction",
          actorUserId: adminUser.uid,
          summary: "Visão atualizada",
          occurredAt: new Date(),
        }],
        eventLimitReached: false,
      });

    render(<WorkspaceHome user={adminUser} canViewTeam onOpenCrm={mockOpenCrm} />);

    expect(await screen.findByText("Não foi possível atualizar esta visão. Tente novamente.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Visão atualizada")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível atualizar esta visão. Tente novamente.")).not.toBeInTheDocument();
  });
});
