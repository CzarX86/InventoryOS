import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { ensureAccessAdmin, getAccessConfig } from "./accessControl";
import { isFeatureEnabled, loadFeatureFlags } from "./featureFlags";
import { withCallErrorHandling } from "./lib/errors";

export const PERFORMANCE_PERIODS = [7, 30, 90] as const;
export type PerformancePeriodDays = (typeof PERFORMANCE_PERIODS)[number] | null;

export function normalizePerformancePeriod(value: unknown): PerformancePeriodDays {
  if (value === null || value === "all") return null;
  const parsed = Number(value);
  return PERFORMANCE_PERIODS.includes(parsed as (typeof PERFORMANCE_PERIODS)[number])
    ? parsed as PerformancePeriodDays
    : 30;
}

export function getPerformanceEventStart(now: number, periodDays: PerformancePeriodDays) {
  if (periodDays == null) return null;
  // Fetch current and previous periods in the same bounded query so the UI
  // can keep showing the comparison without downloading the whole history.
  return new Date(now - (periodDays * 2 * 24 * 60 * 60 * 1000));
}

function serializeDocs(snapshot: FirebaseFirestore.QuerySnapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

type HomeEvent = Record<string, unknown> & {
  id: string;
  actorUserId?: unknown;
  ownerId?: unknown;
  occurredAt?: unknown;
};

function timestampMillis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return 0;
}

export function serializeEmployeeHomeEvent(event: HomeEvent): HomeEvent {
  return {
    id: event.id,
    eventType: typeof event.eventType === "string" ? event.eventType : null,
    channelType: typeof event.channelType === "string" ? event.channelType : null,
    actorUserId: typeof event.actorUserId === "string" ? event.actorUserId : null,
    ownerId: typeof event.ownerId === "string" ? event.ownerId : null,
    contactId: typeof event.contactId === "string" ? event.contactId : null,
    summary: typeof event.summary === "string" ? event.summary : null,
    occurredAt: timestampMillis(event.occurredAt),
    nextContactAt: timestampMillis(event.nextContactAt),
  };
}

export function canAccessHomeTarget(
  targetUid: string,
  requesterUid: string,
  targetProfile: Record<string, unknown> | null,
  workspaceId: string,
  ownerUid: string | null,
) {
  if (!targetUid || !requesterUid || !workspaceId) return false;
  if (targetUid === requesterUid) return true;
  if (!targetProfile || targetUid === ownerUid || targetProfile.isHiddenOwner === true) return false;

  const targetWorkspaceId = targetProfile.workspaceId || targetProfile.defaultAccountId;
  return targetProfile.accessStatus === "approved" && targetWorkspaceId === workspaceId;
}

export function buildEmployeeHomeEvents(
  targetUid: string,
  actorEvents: HomeEvent[],
  legacyOwnerEvents: HomeEvent[],
) {
  const selectedEvents = new Map<string, HomeEvent>();

  actorEvents.forEach((event, index) => {
    if (event.actorUserId !== targetUid) return;
    selectedEvents.set(typeof event.id === "string" ? event.id : `actor-${index}`, event);
  });

  legacyOwnerEvents.forEach((event, index) => {
    if (event.actorUserId || event.ownerId !== targetUid) return;
    const id = typeof event.id === "string" ? event.id : `owner-${index}`;
    if (!selectedEvents.has(id)) selectedEvents.set(id, event);
  });

  return [...selectedEvents.values()].sort((left, right) => (
    timestampMillis(right.occurredAt) - timestampMillis(left.occurredAt)
  ));
}

const HOME_EVENT_QUERY_LIMIT = 200;
const HOME_EVENT_QUERY_WINDOW_DAYS = 8;

export const getWorkspaceHomeSnapshot = onCall(withCallErrorHandling(async (request: any, logger: any) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Faça login para consultar a visão da equipe.");

  const db = getFirestore();
  await ensureAccessAdmin(request.auth, db);

  const { ownerUid, workspaceId } = await getAccessConfig(db);
  if (!workspaceId) throw new HttpsError("failed-precondition", "Workspace não configurado.");

  const targetUid = request.data?.targetUid;
  if (typeof targetUid !== "string" || !targetUid.trim() || targetUid.includes("/")) {
    throw new HttpsError("invalid-argument", "Selecione um usuário válido.");
  }

  const featureFlags = await loadFeatureFlags(db);
  if (!isFeatureEnabled(featureFlags, "teamHomeView")) {
    throw new HttpsError("failed-precondition", "A visão da equipe está desativada.");
  }

  let targetProfile: Record<string, unknown> | null = null;
  if (targetUid !== request.auth.uid) {
    const targetSnapshot = await db.collection("users").doc(targetUid).get();
    targetProfile = (targetSnapshot.data() || null) as Record<string, unknown> | null;
  }
  if (!canAccessHomeTarget(targetUid, request.auth.uid, targetProfile, workspaceId, ownerUid)) {
    throw new HttpsError("permission-denied", "Você só pode consultar a visão de usuários aprovados do seu workspace.");
  }

  const queryStart = new Date(Date.now() - (HOME_EVENT_QUERY_WINDOW_DAYS * 24 * 60 * 60 * 1000));
  const events = db.collection("crm_events");
  const queryLimit = HOME_EVENT_QUERY_LIMIT + 1;
  const actorEventsQuery = events
    .where("workspaceId", "==", workspaceId)
    .where("actorUserId", "==", targetUid)
    .where("occurredAt", ">=", queryStart)
    .orderBy("occurredAt", "desc")
    .limit(queryLimit);
  const legacyOwnerEventsQuery = events
    .where("workspaceId", "==", workspaceId)
    .where("ownerId", "==", targetUid)
    .where("occurredAt", ">=", queryStart)
    .orderBy("occurredAt", "desc")
    .limit(queryLimit);
  const approvedUsersQuery = db.collection("users")
    .where("workspaceId", "==", workspaceId)
    .where("accessStatus", "==", "approved")
    .limit(200);

  const [actorEventsSnapshot, legacyOwnerEventsSnapshot, usersSnapshot] = await Promise.all([
    actorEventsQuery.get(),
    legacyOwnerEventsQuery.get(),
    approvedUsersQuery.get(),
  ]);

  const serializeHomeEvents = (snapshot: FirebaseFirestore.QuerySnapshot): HomeEvent[] => snapshot.docs.map((item) => serializeEmployeeHomeEvent({
    ...item.data(),
    id: item.id,
  } as HomeEvent));
  const candidateEvents = buildEmployeeHomeEvents(
    targetUid,
    serializeHomeEvents(actorEventsSnapshot),
    serializeHomeEvents(legacyOwnerEventsSnapshot),
  );
  const selectedEvents = candidateEvents.slice(0, HOME_EVENT_QUERY_LIMIT);
  const employees = usersSnapshot.docs
    .filter((item) => item.id !== ownerUid && item.data().isHiddenOwner !== true && item.data().accessStatus === "approved")
    .map((item) => {
      const data = item.data();
      return {
        uid: item.id,
        displayName: data.displayName || null,
        email: data.email || null,
      };
    });
  const eventLimitReached = actorEventsSnapshot.size > HOME_EVENT_QUERY_LIMIT
    || legacyOwnerEventsSnapshot.size > HOME_EVENT_QUERY_LIMIT
    || candidateEvents.length > HOME_EVENT_QUERY_LIMIT;

  logger.info("Workspace Home snapshot loaded", {
    workspaceId,
    targetUid,
    eventCount: selectedEvents.length,
    employeeCount: employees.length,
    eventLimitReached,
  });

  return { events: selectedEvents, employees, eventLimitReached };
}));

export const getCrmPerformanceSnapshot = onCall(withCallErrorHandling(async (request: any, logger: any) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Faça login para consultar a performance.");
  const db = getFirestore();
  await ensureAccessAdmin(request.auth, db);
  const { ownerUid, workspaceId } = await getAccessConfig(db);
  if (!workspaceId) throw new HttpsError("failed-precondition", "Workspace não configurado.");

  const periodDays = normalizePerformancePeriod(request.data?.periodDays);
  const eventStart = getPerformanceEventStart(Date.now(), periodDays);
  let eventsQuery: FirebaseFirestore.Query = db.collection("crm_events")
    .where("workspaceId", "==", workspaceId);
  if (eventStart) eventsQuery = eventsQuery.where("occurredAt", ">=", eventStart);
  eventsQuery = eventsQuery.limit(2000);

  const [eventsSnapshot, contactsSnapshot, companiesSnapshot, usersSnapshot] = await Promise.all([
    eventsQuery.get(),
    db.collection("contacts").where("workspaceId", "==", workspaceId).limit(1000).get(),
    db.collection("accounts").where("workspaceId", "==", workspaceId).limit(500).get(),
    db.collection("users").where("workspaceId", "==", workspaceId).limit(200).get(),
  ]);

  const employees = usersSnapshot.docs
    .filter((item) => item.id !== ownerUid && item.data().accessStatus !== "pending")
    .map((item) => {
      const data = item.data();
      return {
        uid: item.id,
        email: data.email || null,
        displayName: data.displayName || null,
        photoURL: data.photoURL || null,
        status: data.accessStatus || "pending",
        role: data.role || "user",
        requestedAt: data.requestedAt || null,
        approvedAt: data.approvedAt || null,
        revokedAt: data.revokedAt || null,
      };
    });

  logger.info("CRM performance snapshot loaded", {
    workspaceId,
    periodDays,
    eventCount: eventsSnapshot.size,
    contactCount: contactsSnapshot.size,
    companyCount: companiesSnapshot.size,
  });

  return {
    events: serializeDocs(eventsSnapshot),
    contacts: serializeDocs(contactsSnapshot),
    companies: serializeDocs(companiesSnapshot),
    employees,
    eventLimitReached: eventsSnapshot.size >= 2000,
  };
}));
