import * as admin from "firebase-admin";
import { FieldValue, Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { createLogger } from "./lib/logger";

export const ACCESS_STATUSES = ["pending", "approved", "revoked"] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];
export type AccessRole = "user" | "admin";

export interface AccessUserSummary {
  uid: string;
  email: string | null;
  displayName: string | null;
  status: AccessStatus;
  role: AccessRole;
  requestedAt: unknown;
  approvedAt: unknown;
  revokedAt: unknown;
}

const ACCESS_CONFIG_PATH = "system/access_control";
const DEFAULT_WORKSPACE_ID = "workspace_inventoryos";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function isConfiguredOwner(auth: any, configuredOwnerEmail: string | undefined) {
  const verifiedEmail = Boolean(auth?.token?.email_verified ?? auth?.email_verified);
  const authEmail = normalizeEmail(auth?.token?.email || auth?.email);
  return verifiedEmail && Boolean(configuredOwnerEmail) && authEmail === normalizeEmail(configuredOwnerEmail);
}

function timestampOrNull(value: unknown) {
  return value || null;
}

function profileForClient(uid: string, data: Record<string, any> = {}) {
  return {
    uid,
    email: data.email || null,
    displayName: data.displayName || null,
    photoURL: data.photoURL || null,
    ownerId: data.ownerId || uid,
    defaultAccountId: data.defaultAccountId || data.workspaceId || null,
    workspaceId: data.workspaceId || data.defaultAccountId || null,
    isHiddenOwner: Boolean(data.isHiddenOwner),
    role: data.role || "user",
    accessStatus: data.accessStatus || "pending",
    aiWorkflow: data.aiWorkflow || "real-time",
    createdAt: timestampOrNull(data.createdAt),
    requestedAt: timestampOrNull(data.requestedAt),
    approvedAt: timestampOrNull(data.approvedAt),
    revokedAt: timestampOrNull(data.revokedAt),
  };
}

export async function getAccessConfig(db: Firestore = admin.firestore()) {
  const ref = db.doc(ACCESS_CONFIG_PATH);
  const snapshot = await ref.get();
  const data = snapshot.exists ? (snapshot.data() || {}) : {};
  return {
    ref,
    ownerUid: data.ownerUid || null,
    workspaceId: data.workspaceId || process.env.PLATFORM_WORKSPACE_ID || DEFAULT_WORKSPACE_ID,
  };
}

async function resolveAccessConfig(auth: any, db: Firestore) {
  const config = await getAccessConfig(db);
  const configuredOwnerEmail = normalizeEmail(process.env.PLATFORM_OWNER_EMAIL);

  let ownerUid = config.ownerUid;
  if (!ownerUid && isConfiguredOwner(auth, configuredOwnerEmail)) {
    ownerUid = auth.uid;
  }

  const workspaceId = config.workspaceId || (ownerUid ? `acct_${ownerUid}` : DEFAULT_WORKSPACE_ID);
  if (ownerUid !== config.ownerUid || workspaceId !== config.workspaceId) {
    await config.ref.set({
      ownerUid: ownerUid || null,
      workspaceId,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return { ownerUid, workspaceId };
}

export async function syncAccessClaims(uid: string, profile: Record<string, any>) {
  const authUser = await admin.auth().getUser(uid);
  const existingClaims = authUser.customClaims || {};
  await admin.auth().setCustomUserClaims(uid, {
    ...existingClaims,
    accessApproved: profile.accessStatus === "approved",
    accessAdmin: profile.accessStatus === "approved" && profile.role === "admin",
    workspaceId: profile.workspaceId || null,
  });
}

export async function initializeAccessProfile(auth: any) {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const db = admin.firestore();
  const { ownerUid, workspaceId } = await resolveAccessConfig(auth, db);
  const userRef = db.collection("users").doc(auth.uid);
  const existing = await userRef.get();
  const isOwner = auth.uid === ownerUid;
  const existingData = existing.exists ? (existing.data() || {}) : {};
  const existingStatus: AccessStatus | null = ACCESS_STATUSES.includes(existingData.accessStatus)
    ? existingData.accessStatus
    : null;
  const hasExplicitAccessStatus = Boolean(existingStatus);
  const isLegacyAdmin = existingData.role === "admin" && !hasExplicitAccessStatus;
  const nextStatus: AccessStatus = isOwner
    ? "approved"
    : (existingStatus || (isLegacyAdmin ? "approved" : "pending"));
  const nextRole: AccessRole = isOwner ? "admin" : (existingData.role === "admin" ? "admin" : "user");
  const profile = {
    email: auth.token?.email || auth.email || existingData.email || null,
    displayName: auth.token?.name || auth.name || existingData.displayName || null,
    photoURL: auth.token?.picture || auth.picture || existingData.photoURL || null,
    ownerId: existingData.ownerId || auth.uid,
    defaultAccountId: workspaceId,
    workspaceId,
    isHiddenOwner: isOwner,
    role: nextRole,
    accessStatus: nextStatus,
    aiWorkflow: existingData.aiWorkflow || "real-time",
    createdAt: existingData.createdAt || FieldValue.serverTimestamp(),
    requestedAt: existingData.requestedAt || FieldValue.serverTimestamp(),
    ...(nextStatus === "approved" && !existingData.approvedAt ? {
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: isOwner ? "system_bootstrap" : "migration",
    } : {}),
  };

  await userRef.set(profile, { merge: true });
  await syncAccessClaims(auth.uid, { ...profile, workspaceId, accessStatus: nextStatus, role: nextRole });

  if (!existing.exists && nextStatus === "pending") {
    const adminSnapshot = await db.collection("users")
      .where("workspaceId", "==", workspaceId)
      .where("accessStatus", "==", "approved")
      .where("role", "==", "admin")
      .get();
    const batch = db.batch();
    adminSnapshot.docs.forEach((adminDoc) => {
      const notificationRef = db.collection("in_app_notifications").doc();
      batch.set(notificationRef, {
        recipientUserId: adminDoc.id,
        type: "access_request",
        title: "Novo pedido de acesso",
        body: "Um usuário solicitou acesso à plataforma.",
        requestUserId: auth.uid,
        readAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  const storedProfile = await userRef.get();
  return profileForClient(auth.uid, {
    ...(storedProfile.data() || {}),
    workspaceId,
    accessStatus: nextStatus,
    role: nextRole,
    isHiddenOwner: isOwner,
  });
}

export async function ensureAccessAdmin(auth: any, db: Firestore = admin.firestore()) {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  const { ownerUid } = await getAccessConfig(db);
  if (auth.uid === ownerUid) {
    return;
  }
  const userSnapshot = await db.collection("users").doc(auth.uid).get();
  const user = userSnapshot.data() || {};
  if (user.accessStatus !== "approved" || user.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin role required");
  }
}

export async function listAccessUsers(auth: any, status?: AccessStatus) {
  const db = admin.firestore();
  await ensureAccessAdmin(auth, db);
  const { ownerUid, workspaceId } = await getAccessConfig(db);
  let query: FirebaseFirestore.Query = db.collection("users").where("workspaceId", "==", workspaceId);
  if (status && ACCESS_STATUSES.includes(status)) {
    query = query.where("accessStatus", "==", status);
  }
  const snapshot = await query.limit(200).get();
  const users = snapshot.docs
    .filter((item) => item.id !== ownerUid)
    .map((item) => {
      const data = item.data();
      return {
        uid: item.id,
        email: data.email || null,
        displayName: data.displayName || null,
        status: data.accessStatus || "pending",
        role: data.role || "user",
        requestedAt: data.requestedAt || null,
        approvedAt: data.approvedAt || null,
        revokedAt: data.revokedAt || null,
      } as AccessUserSummary;
    })
    .sort((left, right) => String(right.requestedAt || "").localeCompare(String(left.requestedAt || "")));
  return { users, ownerExcluded: true };
}

export async function updateAccessStatus(auth: any, targetUid: string, nextStatus: Exclude<AccessStatus, "pending">) {
  const db = admin.firestore();
  await ensureAccessAdmin(auth, db);
  if (!targetUid || targetUid === auth.uid) {
    throw new HttpsError("invalid-argument", "A valid target user is required");
  }

  const { ownerUid, workspaceId } = await getAccessConfig(db);
  if (targetUid === ownerUid) {
    throw new HttpsError("failed-precondition", "The platform owner is protected");
  }

  const targetRef = db.collection("users").doc(targetUid);
  const targetSnapshot = await targetRef.get();
  if (!targetSnapshot.exists) {
    throw new HttpsError("not-found", "Access request not found");
  }
  const target = targetSnapshot.data() || {};
  if (target.workspaceId !== workspaceId) {
    throw new HttpsError("permission-denied", "User belongs to another workspace");
  }

  const update: Record<string, any> = {
    accessStatus: nextStatus,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (nextStatus === "approved") {
    update.approvedAt = FieldValue.serverTimestamp();
    update.approvedBy = auth.uid;
    update.revokedAt = FieldValue.delete();
  } else {
    update.revokedAt = FieldValue.serverTimestamp();
    update.revokedBy = auth.uid;
  }

  await targetRef.set(update, { merge: true });
  await syncAccessClaims(targetUid, { ...target, ...update, accessStatus: nextStatus, workspaceId });

  const notificationRef = db.collection("in_app_notifications").doc();
  await notificationRef.set({
    recipientUserId: targetUid,
    type: `access_${nextStatus}`,
    title: nextStatus === "approved" ? "Acesso aprovado" : "Acesso revogado",
    body: nextStatus === "approved"
      ? "Seu acesso à plataforma foi aprovado."
      : "Seu acesso à plataforma foi revogado.",
    readAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  createLogger({ ownerId: auth.uid, accountId: workspaceId }).info("Access status changed", {
    targetUserId: targetUid,
    status: nextStatus,
  });
  return { uid: targetUid, status: nextStatus };
}
