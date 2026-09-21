import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, functions } from "@/lib/firebase";

export const ACCESS_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REVOKED: "revoked",
} as const;

export type AccessStatus = (typeof ACCESS_STATUS)[keyof typeof ACCESS_STATUS];

export interface AccessProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  role: "user" | "admin";
  accessStatus: AccessStatus;
  workspaceId: string | null;
  defaultAccountId: string | null;
  isHiddenOwner?: boolean;
  aiWorkflow?: string;
}

export interface AccessUserSummary {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  status: AccessStatus;
  role: "user" | "admin";
  requestedAt: unknown;
  approvedAt: unknown;
  revokedAt: unknown;
}

export interface InAppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  requestUserId?: string;
  readAt?: unknown;
  createdAt?: unknown;
}

function requireFunctions() {
  if (!functions) {
    throw new Error("Firebase Functions indisponível neste ambiente.");
  }
  return functions;
}

async function callFunction<TResponse>(name: string, data: Record<string, unknown> = {}) {
  const callable = httpsCallable<Record<string, unknown>, TResponse>(requireFunctions(), name);
  const result = await callable(data);
  return result.data;
}

export function initializeAccessProfile() {
  return callFunction<AccessProfile>("initializeAccessProfile");
}

export function listAccessUsers(status?: AccessStatus) {
  return callFunction<{ users: AccessUserSummary[]; ownerExcluded: boolean }>(
    "listAccessUsers",
    status ? { status } : {},
  );
}

export function approveAccessRequest(targetUid: string) {
  return callFunction<{ uid: string; status: AccessStatus }>("approveAccessRequest", { targetUid });
}

export function revokeAccess(targetUid: string) {
  return callFunction<{ uid: string; status: AccessStatus }>("revokeAccess", { targetUid });
}

export function subscribeToNotifications(
  uid: string,
  onChange: (notifications: InAppNotification[]) => void,
  onError?: (error: Error) => void,
) {
  if (!db || !uid) return () => undefined;
  const notificationsQuery = query(
    collection(db, "in_app_notifications"),
    where("recipientUserId", "==", uid),
    limit(30),
  );
  return onSnapshot(
    notificationsQuery,
    (snapshot) => onChange(snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() } as InAppNotification))
      .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))),
    (error) => onError?.(error),
  );
}

export async function markNotificationAsRead(notificationId: string) {
  if (!db || !notificationId) return;
  await updateDoc(doc(db, "in_app_notifications", notificationId), {
    readAt: new Date(),
  });
}
