import { aggregateCrmPerformance } from "./crmPerformance";

const NOW = Date.parse("2026-09-17T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000);

describe("aggregateCrmPerformance", () => {
  it("aggregates calls, reach, follow-ups and employee attribution for a period", () => {
    const result = aggregateCrmPerformance({
      now: NOW,
      periodDays: 30,
      events: [
        { id: "e1", eventType: "contact_interaction", channelType: "phone", actorUserId: "u1", contactId: "c1", occurredAt: daysAgo(1), nextContactAt: new Date(NOW + 3 * 24 * 60 * 60 * 1000) },
        { id: "e2", eventType: "contact_interaction", channelType: "whatsapp", actorUserId: "u1", contactId: "c2", occurredAt: daysAgo(2) },
        { id: "e3", eventType: "contact_interaction", channelType: "phone", actorUserId: "u2", contactId: "c1", occurredAt: daysAgo(4), nextContactAt: new Date(NOW + 4 * 24 * 60 * 60 * 1000) },
        { id: "e4", eventType: "contact_interaction", channelType: "email", actorUserId: "u2", occurredAt: daysAgo(6) },
        { id: "e5", eventType: "contact_interaction", channelType: "phone", ownerId: "system", contactId: "c3", occurredAt: daysAgo(8) },
        { id: "milestone", eventType: "milestone", channelType: "whatsapp", actorUserId: "u1", contactId: "c5", occurredAt: daysAgo(9) },
        { id: "old", eventType: "contact_interaction", channelType: "phone", actorUserId: "u1", contactId: "c4", occurredAt: daysAgo(45) },
      ],
      contacts: [
        { id: "c1", name: "Cliente 1", nextContactAt: daysAgo(3) },
        { id: "c2", name: "Cliente 2", nextContactAt: new Date(NOW + 4 * 24 * 60 * 60 * 1000) },
        { id: "c3", name: "Cliente 3", nextContactAt: daysAgo(12) },
      ],
      employees: [
        { uid: "u1", displayName: "Ana", status: "approved" },
        { uid: "u2", displayName: "Bruno", status: "approved" },
      ],
    });

    expect(result.totalInteractions).toBe(5);
    expect(result.calls).toBe(3);
    expect(result.contactsReached).toBe(3);
    expect(result.contactsReachedInActiveBase).toBe(3);
    expect(result.scheduledFollowUps).toBe(2);
    expect(result.attributedInteractions).toBe(4);
    expect(result.attributionRate).toBe(80);
    expect(result.overdueContacts.map((contact) => contact.id)).toEqual(["c3", "c1"]);

    expect(result.employeeMetrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ uid: "u1", totalInteractions: 2, calls: 1, contactsReached: 2, scheduledFollowUps: 1 }),
      expect.objectContaining({ uid: "u2", totalInteractions: 2, calls: 1, contactsReached: 1, scheduledFollowUps: 1 }),
      expect.objectContaining({ uid: "unassigned", totalInteractions: 1, calls: 1, contactsReached: 1 }),
    ]));
  });

  it("returns a same-length previous-period comparison without counting future events", () => {
    const result = aggregateCrmPerformance({
      now: NOW,
      periodDays: 7,
      events: [
        { id: "current", eventType: "contact_interaction", channelType: "phone", actorUserId: "u1", contactId: "c1", occurredAt: daysAgo(1) },
        { id: "previous", eventType: "contact_interaction", channelType: "phone", actorUserId: "u1", contactId: "c2", occurredAt: daysAgo(10) },
        { id: "future", eventType: "contact_interaction", channelType: "phone", actorUserId: "u1", contactId: "c3", occurredAt: new Date(NOW + 24 * 60 * 60 * 1000) },
      ],
      contacts: [],
      employees: [{ uid: "u1", displayName: "Ana", status: "approved" }],
    });

    expect(result.totalInteractions).toBe(1);
    expect(result.previousPeriod?.totalInteractions).toBe(1);
    expect(result.trend).toHaveLength(7);
  });

  it("does not fabricate a comparison for the all-time view", () => {
    const result = aggregateCrmPerformance({
      now: NOW,
      periodDays: null,
      events: [{ id: "e1", eventType: "contact_interaction", channelType: "phone", actorUserId: "u1", occurredAt: daysAgo(400) }],
      contacts: [],
      employees: [],
    });

    expect(result.totalInteractions).toBe(1);
    expect(result.previousPeriod).toBeNull();
  });

  it("keeps hidden-owner activity out of visible employee identities", () => {
    const result = aggregateCrmPerformance({
      now: NOW,
      periodDays: 30,
      hiddenEmployeeIds: ["owner-1"],
      events: [{ eventType: "contact_interaction", channelType: "phone", actorUserId: "owner-1", contactId: "c1", occurredAt: daysAgo(1) }],
      contacts: [],
      employees: [],
    });

    expect(result.employeeMetrics).toEqual([expect.objectContaining({ uid: "unassigned", name: "Sem atribuição" })]);
    expect(result.attributionRate).toBe(0);
  });
});
