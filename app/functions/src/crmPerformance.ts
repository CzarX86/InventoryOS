import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { ensureAccessAdmin, getAccessConfig } from "./accessControl";
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
