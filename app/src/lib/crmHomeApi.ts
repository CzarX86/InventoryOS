import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type WorkspaceHomeEmployee = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
};

export type WorkspaceHomeEvent = {
  id: string;
  eventType?: string | null;
  channelType?: string | null;
  actorUserId?: string | null;
  ownerId?: string | null;
  contactId?: string | null;
  summary?: string | null;
  occurredAt?: unknown;
  nextContactAt?: unknown;
};

export type WorkspaceHomeSnapshot = {
  events: WorkspaceHomeEvent[];
  employees: WorkspaceHomeEmployee[];
  eventLimitReached: boolean;
};

export async function getWorkspaceHomeSnapshot(targetUid: string) {
  if (!functions) throw new Error("Firebase Functions indisponível neste ambiente.");
  const callable = httpsCallable<{ targetUid: string }, WorkspaceHomeSnapshot>(functions, "getWorkspaceHomeSnapshot");
  const result = await callable({ targetUid });
  return result.data;
}
