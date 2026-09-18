const DAY_IN_MS = 24 * 60 * 60 * 1000;
const SYSTEM_ACTORS = new Set(["system", "ai", "automation", "bot"]);

export type PeriodDays = 7 | 30 | 90 | null;

export type CrmPerformanceEvent = {
  id?: string;
  eventType?: string | null;
  channelType?: string | null;
  actorUserId?: string | null;
  ownerId?: string | null;
  contactId?: string | null;
  remoteJid?: string | null;
  occurredAt?: unknown;
  nextContactAt?: unknown;
};

export type CrmPerformanceContact = {
  id: string;
  name?: string | null;
  displayName?: string | null;
  companyId?: string | null;
  status?: string | null;
  lastContactAt?: unknown;
  nextContactAt?: unknown;
};

export type CrmPerformanceEmployee = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  status?: string | null;
};

export type TimeRange = {
  start: number | null;
  end: number;
};

export type PerformancePeriodSummary = {
  totalInteractions: number;
  calls: number;
  contactsReached: number;
  scheduledFollowUps: number;
};

export type EmployeePerformanceMetric = PerformancePeriodSummary & {
  uid: string;
  name: string;
  email: string | null;
  status: string | null;
  isUnassigned?: boolean;
};

export type TrendPoint = {
  key: string;
  label: string;
  start: number;
  end: number;
  interactions: number;
  calls: number;
};

export type OverdueContact = CrmPerformanceContact & {
  overdueSince: number;
};

export type CrmPerformanceResult = PerformancePeriodSummary & {
  channels: Record<string, number>;
  employeeMetrics: EmployeePerformanceMetric[];
  attributedInteractions: number;
  attributionRate: number;
  activeContacts: number;
  contactsReachedInActiveBase: number;
  overdueContacts: OverdueContact[];
  trend: TrendPoint[];
  currentRange: TimeRange;
  previousPeriod: PerformancePeriodSummary | null;
};

type AggregateInput = {
  now: number;
  periodDays: PeriodDays;
  events: CrmPerformanceEvent[];
  contacts: CrmPerformanceContact[];
  employees: CrmPerformanceEmployee[];
  hiddenEmployeeIds?: string[];
};

type InternalEmployeeMetric = EmployeePerformanceMetric & {
  contactIds: Set<string>;
};

export function timestampToMillis(value: unknown): number {
  if (typeof (value as { toMillis?: () => number })?.toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof (value as { toDate?: () => Date })?.toDate === "function") {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function getPeriodRange(now: number, periodDays: PeriodDays): TimeRange {
  return {
    start: periodDays == null ? null : now - periodDays * DAY_IN_MS,
    end: now,
  };
}

function isInRange(value: unknown, range: TimeRange) {
  const timestamp = timestampToMillis(value);
  if (!timestamp || timestamp > range.end) return false;
  return range.start == null || timestamp >= range.start;
}

function isInteractionEvent(event: CrmPerformanceEvent) {
  // Extracted milestones can also carry a channel. Count only explicit
  // contact interactions, while retaining compatibility with older records
  // that have a channel but no eventType.
  return event.eventType === "contact_interaction" || (!event.eventType && Boolean(event.channelType));
}

function isSystemActor(value: string | null | undefined) {
  return !value || SYSTEM_ACTORS.has(value.trim().toLowerCase());
}

function getActorId(event: CrmPerformanceEvent, hiddenEmployeeIds: Set<string>) {
  if (!isSystemActor(event.actorUserId) && !hiddenEmployeeIds.has(event.actorUserId!.trim())) return event.actorUserId!.trim();
  if (!isSystemActor(event.ownerId) && !hiddenEmployeeIds.has(event.ownerId!.trim())) return event.ownerId!.trim();
  return "unassigned";
}

function getContactKey(event: CrmPerformanceEvent) {
  return event.contactId?.trim() || event.remoteJid?.trim() || null;
}

function createEmployeeMetric(employee: CrmPerformanceEmployee): InternalEmployeeMetric {
  return {
    uid: employee.uid,
    name: employee.displayName?.trim() || employee.email?.trim() || (employee.uid === "unassigned" ? "Sem atribuição" : `Usuário ${employee.uid.slice(0, 8)}`),
    email: employee.email || null,
    status: employee.status || null,
    totalInteractions: 0,
    calls: 0,
    contactsReached: 0,
    scheduledFollowUps: 0,
    contactIds: new Set<string>(),
  };
}

function summarizeEvents(events: CrmPerformanceEvent[]): PerformancePeriodSummary {
  const contacts = new Set<string>();
  let calls = 0;
  let scheduledFollowUps = 0;

  events.forEach((event) => {
    if (event.channelType === "phone") calls += 1;
    const contactKey = getContactKey(event);
    if (contactKey) contacts.add(contactKey);
    if (timestampToMillis(event.nextContactAt)) scheduledFollowUps += 1;
  });

  return {
    totalInteractions: events.length,
    calls,
    contactsReached: contacts.size,
    scheduledFollowUps,
  };
}

function buildTrend(events: CrmPerformanceEvent[], range: TimeRange, periodDays: PeriodDays): TrendPoint[] {
  const timestampedEvents = events
    .filter((event) => isInteractionEvent(event) && isInRange(event.occurredAt, range))
    .map((event) => ({ event, timestamp: timestampToMillis(event.occurredAt) }))
    .filter(({ timestamp }) => timestamp > 0);
  const firstEventTimestamp = timestampedEvents.reduce(
    (minimum, item) => Math.min(minimum, item.timestamp),
    range.end,
  );
  const start = range.start ?? (timestampedEvents.length ? firstEventTimestamp : range.end - 11 * DAY_IN_MS);
  const span = Math.max(DAY_IN_MS, range.end - start);
  const bucketCount = periodDays == null ? 12 : Math.min(periodDays, 14);
  const bucketSize = span / bucketCount;

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = start + index * bucketSize;
    const bucketEnd = index === bucketCount - 1 ? range.end : start + (index + 1) * bucketSize;
    const bucketEvents = timestampedEvents.filter(({ timestamp }) => (
      timestamp >= bucketStart && (index === bucketCount - 1 ? timestamp <= bucketEnd : timestamp < bucketEnd)
    ));
    const bucketDate = new Date(bucketStart);
    return {
      key: `${bucketStart}`,
      label: bucketDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      start: bucketStart,
      end: bucketEnd,
      interactions: bucketEvents.length,
      calls: bucketEvents.filter(({ event }) => event.channelType === "phone").length,
    };
  });
}

function buildOverdueContacts(contacts: CrmPerformanceContact[], now: number): OverdueContact[] {
  return contacts
    .map((contact) => ({ ...contact, overdueSince: timestampToMillis(contact.nextContactAt) }))
    .filter((contact) => contact.overdueSince > 0 && contact.overdueSince < now && contact.status !== "inactive")
    .sort((left, right) => left.overdueSince - right.overdueSince);
}

export function aggregateCrmPerformance({ now, periodDays, events, contacts, employees, hiddenEmployeeIds = [] }: AggregateInput): CrmPerformanceResult {
  const currentRange = getPeriodRange(now, periodDays);
  const hiddenActors = new Set(hiddenEmployeeIds);
  const currentEvents = events.filter((event) => isInteractionEvent(event) && isInRange(event.occurredAt, currentRange));
  const summary = summarizeEvents(currentEvents);
  const channels = currentEvents.reduce<Record<string, number>>((counts, event) => {
    const channel = event.channelType || "other";
    counts[channel] = (counts[channel] || 0) + 1;
    return counts;
  }, {});
  const metrics = new Map<string, InternalEmployeeMetric>();

  employees.forEach((employee) => {
    if (employee.uid) metrics.set(employee.uid, createEmployeeMetric(employee));
  });

  currentEvents.forEach((event) => {
    const actorId = getActorId(event, hiddenActors);
    if (!metrics.has(actorId)) {
      metrics.set(actorId, actorId === "unassigned"
        ? { ...createEmployeeMetric({ uid: actorId, displayName: "Sem atribuição" }), isUnassigned: true }
        : createEmployeeMetric({ uid: actorId }));
    }
    const metric = metrics.get(actorId)!;
    metric.totalInteractions += 1;
    if (event.channelType === "phone") metric.calls += 1;
    if (timestampToMillis(event.nextContactAt)) metric.scheduledFollowUps += 1;
    const contactKey = getContactKey(event);
    if (contactKey) metric.contactIds.add(contactKey);
  });

  const employeeMetrics = Array.from(metrics.values())
    .map(({ contactIds, ...metric }) => ({ ...metric, contactsReached: contactIds.size }))
    .filter((metric) => metric.uid !== "unassigned" || metric.totalInteractions > 0)
    .sort((left, right) => (
      right.calls - left.calls
      || right.totalInteractions - left.totalInteractions
      || left.name.localeCompare(right.name, "pt-BR")
    ));
  const attributedInteractions = currentEvents.filter((event) => getActorId(event, hiddenActors) !== "unassigned").length;
  const activeContactIds = new Set(contacts.filter((contact) => contact.status !== "inactive").map((contact) => contact.id));
  const contactsReachedInActiveBase = new Set(
    currentEvents
      .map((event) => event.contactId?.trim() || null)
      .filter((contactId): contactId is string => Boolean(contactId && activeContactIds.has(contactId))),
  ).size;
  const previousPeriod = periodDays == null ? null : summarizeEvents(events.filter((event) => {
    if (!isInteractionEvent(event)) return false;
    const previousRange: TimeRange = {
      start: currentRange.start! - periodDays * DAY_IN_MS,
      end: currentRange.start! - 1,
    };
    return isInRange(event.occurredAt, previousRange);
  }));

  return {
    ...summary,
    channels,
    employeeMetrics,
    attributedInteractions,
    attributionRate: summary.totalInteractions ? Math.round((attributedInteractions / summary.totalInteractions) * 1000) / 10 : 0,
    activeContacts: contacts.filter((contact) => contact.status !== "inactive").length,
    contactsReachedInActiveBase,
    overdueContacts: buildOverdueContacts(contacts, now),
    trend: buildTrend(events, currentRange, periodDays),
    currentRange,
    previousPeriod,
  };
}
