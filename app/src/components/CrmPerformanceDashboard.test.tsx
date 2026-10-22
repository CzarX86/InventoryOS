import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { aggregateCrmPerformance } from "@/lib/crmPerformance";
import CrmPerformanceDashboard from "./CrmPerformanceDashboard";

jest.mock("@/lib/crmPerformance", () => {
  const actual = jest.requireActual("@/lib/crmPerformance");
  return { ...actual, aggregateCrmPerformance: jest.fn((args: unknown) => (actual as { aggregateCrmPerformance: (a: never) => unknown }).aggregateCrmPerformance(args as never)) };
});

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

  it("recomputes the aggregation reference time on refresh instead of reusing the mount time", async () => {
    const aggregate = aggregateCrmPerformance as unknown as jest.Mock;
    aggregate.mockClear();
    const firstNow = new Date(2026, 8, 17, 12, 0, 0).getTime();
    const secondNow = firstNow + (60 * 60 * 1000);
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(firstNow);
    try {
      render(<CrmPerformanceDashboard user={{ uid: "u1", displayName: "Ana", email: "ana@example.com", workspaceId: "workspace-1" }} />);
      await waitFor(() => expect(screen.getByText("Ligações registradas")).toBeInTheDocument());
      const calls = aggregate.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[calls.length - 1][0].now).toBe(firstNow);

      nowSpy.mockReturnValue(secondNow);
      fireEvent.click(screen.getByRole("button", { name: /atualizar/i }));
      await waitFor(() => {
        const refreshed = aggregate.mock.calls;
        expect(refreshed[refreshed.length - 1][0].now).toBe(secondNow);
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("reloads the snapshot when the analysis period changes", async () => {
    const { getCrmPerformanceSnapshot } = jest.requireMock("@/lib/crmPerformanceApi") as { getCrmPerformanceSnapshot: jest.Mock };
    getCrmPerformanceSnapshot.mockClear();
    render(<CrmPerformanceDashboard user={{ uid: "u1", displayName: "Ana", email: "ana@example.com", workspaceId: "workspace-1" }} />);
    await waitFor(() => expect(screen.getByText("Ligações registradas")).toBeInTheDocument());
    expect(getCrmPerformanceSnapshot).toHaveBeenCalledWith(30);

    fireEvent.change(screen.getByLabelText("Período de análise"), { target: { value: "7" } });
    await waitFor(() => expect(getCrmPerformanceSnapshot).toHaveBeenCalledWith(7));
  });
});
