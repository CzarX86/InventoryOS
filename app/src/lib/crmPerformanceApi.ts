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

export async function getCrmPerformanceSnapshot(periodDays: PeriodDays) {
  if (!functions) throw new Error("Firebase Functions indisponível neste ambiente.");
  const callable = httpsCallable<{ periodDays: PeriodDays }, CrmPerformanceSnapshot>(functions, "getCrmPerformanceSnapshot");
  const result = await callable({ periodDays });
  return result.data;
}
