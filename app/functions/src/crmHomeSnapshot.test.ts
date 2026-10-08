import { buildEmployeeHomeEvents, canAccessHomeTarget, serializeEmployeeHomeEvent } from "./crmPerformance";

describe("employee Home snapshot access", () => {
  it("allows the caller to view their own workspace home", () => {
    expect(canAccessHomeTarget("admin-1", "admin-1", null, "workspace-1", "owner-1")).toBe(true);
  });

  it("allows only approved members of the same workspace and never exposes the hidden owner", () => {
    expect(canAccessHomeTarget("employee-2", "admin-1", {
      accessStatus: "approved",
      workspaceId: "workspace-1",
    }, "workspace-1", "owner-1")).toBe(true);
    expect(canAccessHomeTarget("employee-2", "admin-1", {
      accessStatus: "pending",
      workspaceId: "workspace-1",
    }, "workspace-1", "owner-1")).toBe(false);
    expect(canAccessHomeTarget("employee-2", "admin-1", {
      accessStatus: "approved",
      workspaceId: "another-workspace",
    }, "workspace-1", "owner-1")).toBe(false);
    expect(canAccessHomeTarget("owner-1", "admin-1", {
      accessStatus: "approved",
      workspaceId: "workspace-1",
    }, "workspace-1", "owner-1")).toBe(false);
    expect(canAccessHomeTarget("owner-2", "admin-1", {
      accessStatus: "approved",
      workspaceId: "workspace-1",
      isHiddenOwner: true,
    }, "workspace-1", null)).toBe(false);
  });

  it("keeps only the selected person's attributed events and merges legacy ownership once", () => {
    const events = buildEmployeeHomeEvents("employee-2", [
      { id: "actor-event", actorUserId: "employee-2", occurredAt: new Date(3000) },
      { id: "wrong-actor", actorUserId: "employee-3", occurredAt: new Date(4000) },
    ], [
      { id: "legacy-event", ownerId: "employee-2", occurredAt: new Date(2000) },
      { id: "wrong-modern-event", ownerId: "employee-2", actorUserId: "employee-3", occurredAt: new Date(5000) },
      { id: "actor-event", ownerId: "employee-2", actorUserId: "employee-2", occurredAt: new Date(3000) },
    ]);

    expect(events.map((event) => event.id)).toEqual(["actor-event", "legacy-event"]);
  });

  it("serializes only the Home fields and converts timestamps to client-safe milliseconds", () => {
    const serialized = serializeEmployeeHomeEvent({
      id: "event-1",
      eventType: "contact_interaction",
      channelType: "phone",
      actorUserId: "employee-2",
      contactId: "contact-1",
      summary: "Retorno combinado",
      occurredAt: new Date(10_000),
      nextContactAt: { toMillis: () => 20_000 },
      privatePayload: { sourceMessage: "não deve sair da função" },
    });

    expect(serialized).toEqual({
      id: "event-1",
      eventType: "contact_interaction",
      channelType: "phone",
      actorUserId: "employee-2",
      ownerId: null,
      contactId: "contact-1",
      summary: "Retorno combinado",
      occurredAt: 10_000,
      nextContactAt: 20_000,
    });
    expect(serialized).not.toHaveProperty("privatePayload");
  });
});
