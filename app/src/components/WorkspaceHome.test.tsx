import { buildHomeMetrics } from "./WorkspaceHome";

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
