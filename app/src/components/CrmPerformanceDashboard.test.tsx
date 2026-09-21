import { render, screen, waitFor } from "@testing-library/react";
import CrmPerformanceDashboard from "./CrmPerformanceDashboard";

jest.mock("@/lib/firebase", () => ({ db: {} }));

jest.mock("@/lib/accessControl", () => ({
  listAccessUsers: jest.fn().mockResolvedValue({
    users: [{ uid: "u2", displayName: "Bruno", email: "bruno@example.com", status: "approved", role: "user" }],
  }),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((db, collectionName) => ({ db, collectionName })),
  where: jest.fn(),
  limit: jest.fn(),
  query: jest.fn((ref) => ref),
  onSnapshot: jest.fn((ref: { collectionName: string }, onNext: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void) => {
    const docs = {
      crm_events: [
        { id: "event-1", data: () => ({ eventType: "contact_interaction", channelType: "phone", actorUserId: "u1", contactId: "contact-1", occurredAt: new Date() }) },
        { id: "event-2", data: () => ({ eventType: "contact_interaction", channelType: "whatsapp", actorUserId: "u2", contactId: "contact-2", occurredAt: new Date() }) },
      ],
      contacts: [
        { id: "contact-1", data: () => ({ name: "Cliente 1", status: "active" }) },
        { id: "contact-2", data: () => ({ name: "Cliente 2", status: "active" }) },
      ],
      accounts: [],
    }[ref.collectionName] || [];
    onNext({ docs });
    return jest.fn();
  }),
}));

describe("CrmPerformanceDashboard", () => {
  it("renders CRM activity KPIs and the employee comparison", async () => {
    render(<CrmPerformanceDashboard user={{ uid: "u1", displayName: "Ana", email: "ana@example.com", workspaceId: "workspace-1" }} />);

    await waitFor(() => expect(screen.getByText("Ligações registradas")).toBeInTheDocument());

    expect(screen.getByText("Ligações registradas")).toBeInTheDocument();
    expect(screen.getByText("Contatos alcançados")).toBeInTheDocument();
    expect(screen.getByText("Performance por funcionário")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(screen.getByText(/Definição: ligação é um evento CRM/)).toBeInTheDocument();
  });
});
