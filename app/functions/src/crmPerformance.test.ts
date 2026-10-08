import { getPerformanceEventStart, normalizePerformancePeriod } from "./crmPerformance";

describe("CRM performance query bounds", () => {
  it("normalizes supported periods and defaults invalid values", () => {
    expect(normalizePerformancePeriod(7)).toBe(7);
    expect(normalizePerformancePeriod("all")).toBeNull();
    expect(normalizePerformancePeriod("invalid")).toBe(30);
  });

  it("fetches only the current and comparable previous period", () => {
    const now = Date.parse("2026-09-21T12:00:00.000Z");
    expect(getPerformanceEventStart(now, 30)?.toISOString()).toBe("2026-07-23T12:00:00.000Z");
    expect(getPerformanceEventStart(now, null)).toBeNull();
  });
});
