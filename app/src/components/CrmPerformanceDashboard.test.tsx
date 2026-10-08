import { render, screen, waitFor } from "@testing-library/react";
import CrmPerformanceDashboard from "./CrmPerformanceDashboard";

jest.mock("@/lib/crmPerformanceApi", () => ({
  getCrmPerformanceSnapshot: jest.fn().mockResolvedValue({
    events: [
      { id: "event-1", eventType: "contact_interaction", channelType: "phone", actorUserId: "u1", contactId: "contact-1", occurredAt: new Date() },
      { id: "event-2", eventType: "contact_interaction", channelType: "whatsapp", actorUserId: "u2", contactId: "contact-2", occurredAt: new Date() },
    ],
    contacts: [
      { id: "contact-1", name: "Cliente 1", status: "active" },
      { id: "contact-2", name: "Cliente 2", status: "active" },
    ],
    companies: [],
    employees: [{ uid: "u2", displayName: "Bruno", email: "bruno@example.com", status: "approved", role: "user" }],
    eventLimitReached: false,
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
