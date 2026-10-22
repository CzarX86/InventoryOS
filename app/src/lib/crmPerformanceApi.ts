import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { AccessUserSummary } from "@/lib/accessControl";
import type { PeriodDays, CrmPerformanceContact, CrmPerformanceEvent } from "@/lib/crmPerformance";

export type CrmPerformanceSnapshot = {
  events: CrmPerformanceEvent[];
  contacts: CrmPerformanceContact[];
  companies: Array<{ id: string; name?: string | null }>;
  employees: AccessUserSummary[];
  eventLimitReached: boolean;
};

type SnapshotOptions = {
  forceRefresh?: boolean;
};

const SNAPSHOT_CACHE_TTL_MS = 30_000;
const snapshotCache = new Map<string, { snapshot: CrmPerformanceSnapshot; expiresAt: number }>();
const snapshotRequests = new Map<string, Promise<CrmPerformanceSnapshot>>();

function getSnapshotKey(periodDays: PeriodDays) {
  return periodDays == null ? "all" : String(periodDays);
}

export async function getCrmPerformanceSnapshot(periodDays: PeriodDays, options: SnapshotOptions = {}) {
  if (!functions) throw new Error("Firebase Functions indisponível neste ambiente.");
  const key = getSnapshotKey(periodDays);
  const cached = snapshotCache.get(key);
  if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) return cached.snapshot;

  const inFlight = snapshotRequests.get(key);
  if (inFlight) return inFlight;

  const callable = httpsCallable<{ periodDays: PeriodDays }, CrmPerformanceSnapshot>(functions, "getCrmPerformanceSnapshot");
  const request = callable({ periodDays })
    .then((result) => {
      snapshotCache.set(key, { snapshot: result.data, expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS });
      return result.data;
    })
    .finally(() => {
      snapshotRequests.delete(key);
    });

  snapshotRequests.set(key, request);
  return request;
}

export function prefetchCrmPerformanceSnapshot(periodDays: PeriodDays = 30) {
  return getCrmPerformanceSnapshot(periodDays).catch(() => undefined);
}
