import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { ensureAccessAdmin, getAccessConfig } from "./accessControl";
import { withCallErrorHandling } from "./lib/errors";
import { logAudit } from "./lib/audit";

const DELETED_CONTACTS_COLLECTION = "crm_deleted_records";

function requireContactId(value: unknown) {
  const contactId = String(value || "").trim();
  if (!contactId) throw new HttpsError("invalid-argument", "Contato inválido.");
  return contactId;
}

async function getAdminWorkspace(auth: any) {
  const db = getFirestore();
  await ensureAccessAdmin(auth, db);
  const accessConfig = await getAccessConfig(db);
  const workspaceId = auth?.token?.workspaceId || accessConfig.workspaceId;
  if (!workspaceId) throw new HttpsError("failed-precondition", "Workspace não configurado.");
  return { db, workspaceId };
}

export function buildSoftDeletedContactPatch(actorId: string) {
  return {
    status: "deleted",
    deletedBy: actorId,
    deletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export function buildRestoredContactPatch(previousStatus: string, actorId: string) {
  return {
    status: previousStatus || "active",
    deletedBy: FieldValue.delete(),
    deletedAt: FieldValue.delete(),
    deletionId: FieldValue.delete(),
    restoredBy: actorId,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export const deleteCrmContact = onCall(withCallErrorHandling(async (request: any, logger: any) => {
  const { db, workspaceId } = await getAdminWorkspace(request.auth);
  const contactId = requireContactId(request.data?.contactId);
  const contactRef = db.collection("contacts").doc(contactId);
  const contactSnapshot = await contactRef.get();
  if (!contactSnapshot.exists) throw new HttpsError("not-found", "Contato não encontrado.");

  const contact = contactSnapshot.data() || {};
  if (contact.workspaceId !== workspaceId) throw new HttpsError("permission-denied", "Contato pertence a outro workspace.");
  if (contact.status === "deleted") throw new HttpsError("failed-precondition", "Este contato já está na lixeira.");

  const deletionRef = db.collection(DELETED_CONTACTS_COLLECTION).doc();
  const deletionRecord = {
    type: "crm_contact_deletion",
    workspaceId,
    contactId,
    displayName: contact.displayName || contact.name || "Contato sem nome",
    previousStatus: contact.status || "active",
    contactSnapshot: contact,
    status: "deleted",
    deletedBy: request.auth.uid,
    deletedAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)),
  };

  const batch = db.batch();
  batch.set(deletionRef, deletionRecord);
  batch.update(contactRef, { ...buildSoftDeletedContactPatch(request.auth.uid), deletionId: deletionRef.id });
  await batch.commit();

  await logAudit({
    action: "crm_contact_soft_deleted",
    category: "data",
    actorId: request.auth.uid,
    targetId: contactId,
    details: { deletionId: deletionRef.id, workspaceId, retentionDays: 90 },
    severity: "warning",
  });
  logger.info("CRM contact moved to recycle bin", { contactId, deletionId: deletionRef.id, workspaceId });
  return { contactId, deletionId: deletionRef.id, status: "deleted" };
}));

export const listDeletedCrmContacts = onCall(withCallErrorHandling(async (request: any, logger: any) => {
  const { db, workspaceId } = await getAdminWorkspace(request.auth);
  const snapshot = await db.collection(DELETED_CONTACTS_COLLECTION)
    .where("workspaceId", "==", workspaceId)
    .limit(100)
    .get();
  const items = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item: any) => item.status === "deleted")
    .sort((left: any, right: any) => String(right.deletedAt || "").localeCompare(String(left.deletedAt || "")));
  logger.info("CRM recycle bin listed", { workspaceId, count: items.length });
  return { items };
}));

export const restoreCrmContact = onCall(withCallErrorHandling(async (request: any, logger: any) => {
  const { db, workspaceId } = await getAdminWorkspace(request.auth);
  const deletionId = String(request.data?.deletionId || "").trim();
  if (!deletionId) throw new HttpsError("invalid-argument", "Registro de lixeira inválido.");

  const deletionRef = db.collection(DELETED_CONTACTS_COLLECTION).doc(deletionId);
  const deletionSnapshot = await deletionRef.get();
  if (!deletionSnapshot.exists) throw new HttpsError("not-found", "Registro de lixeira não encontrado.");
  const deletion = deletionSnapshot.data() || {};
  if (deletion.workspaceId !== workspaceId) throw new HttpsError("permission-denied", "Registro pertence a outro workspace.");
  if (deletion.status !== "deleted") throw new HttpsError("failed-precondition", "Este registro não está disponível para restauração.");

  const contactId = requireContactId(deletion.contactId);
  const contactRef = db.collection("contacts").doc(contactId);
  const contactSnapshot = await contactRef.get();
  if (!contactSnapshot.exists) throw new HttpsError("not-found", "O contato original não foi encontrado.");

  const batch = db.batch();
  batch.update(contactRef, buildRestoredContactPatch(String(deletion.previousStatus || "active"), request.auth.uid));
  batch.update(deletionRef, {
    status: "restored",
    restoredBy: request.auth.uid,
    restoredAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  await logAudit({
    action: "crm_contact_restored",
    category: "data",
    actorId: request.auth.uid,
    targetId: contactId,
    details: { deletionId, workspaceId },
    severity: "info",
  });
  logger.info("CRM contact restored from recycle bin", { contactId, deletionId, workspaceId });
  return { contactId, deletionId, status: "restored" };
}));
