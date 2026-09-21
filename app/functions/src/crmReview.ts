import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { withCallErrorHandling } from "./lib/errors";
import { buildOwnershipContext } from "./ownership";
import { createInterestRecord, createOpportunityRecord, createTaskRecord } from "./crmDomain";

export type CrmReviewKind = "opportunity" | "task" | "cross_sell";

export function createCrmReviewItemRecord(payload: any = {}, ownershipContext: any = {}) {
  return {
    type: "crm_review_item",
    workspaceId: ownershipContext.workspaceId || null,
    accountId: ownershipContext.defaultAccountId || null,
    ownerId: ownershipContext.ownerId || "system",
    kind: payload.kind || "task",
    status: "pending",
    source: payload.source || "whatsapp_ai",
    sourceMessageIds: Array.isArray(payload.sourceMessageIds) ? payload.sourceMessageIds : [],
    remoteJid: payload.remoteJid || null,
    contactId: payload.contactId || null,
    companyId: payload.companyId || null,
    summary: payload.summary || null,
    confidence: payload.confidence ?? null,
    suggestion: payload.suggestion || {},
    aiRunId: payload.aiRunId || null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function requireApproved(request: any) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Faça login para revisar a sugestão.");
  if (request.auth.token?.accessApproved !== true) throw new HttpsError("permission-denied", "Seu acesso ainda não está aprovado.");
  const ownership = buildOwnershipContext(request.auth);
  if (!ownership.workspaceId) throw new HttpsError("failed-precondition", "Workspace não configurado.");
  return ownership;
}

export const approveCrmReviewItem = onCall(withCallErrorHandling(async (request: any, logger: any) => {
  const ownership = requireApproved(request);
  const db = getFirestore();
  const reviewId = String(request.data?.reviewId || "");
  const reviewRef = db.collection("crm_review_items").doc(reviewId);
  const reviewSnapshot = await reviewRef.get();
  const review = reviewSnapshot.data();
  if (!reviewSnapshot.exists || review?.workspaceId !== ownership.workspaceId) throw new HttpsError("not-found", "Sugestão não encontrada.");
  const reviewData = review as Record<string, any>;
  if (reviewData.status !== "pending") throw new HttpsError("failed-precondition", "Esta sugestão já foi revisada.");

  const suggestion = { ...(reviewData.suggestion || {}), contactId: reviewData.contactId, companyId: reviewData.companyId, remoteJid: reviewData.remoteJid, sourceMessageIds: reviewData.sourceMessageIds, source: "whatsapp_ai_approved" };
  const targetCollection = reviewData.kind === "opportunity" ? "opportunities" : reviewData.kind === "cross_sell" ? "interests" : "tasks";
  const targetRef = db.collection(targetCollection).doc();
  const targetRecord = reviewData.kind === "opportunity"
    ? createOpportunityRecord(suggestion, ownership)
    : reviewData.kind === "cross_sell"
      ? createInterestRecord(suggestion, ownership)
      : createTaskRecord(suggestion, ownership);
  const batch = db.batch();
  batch.set(targetRef, { ...targetRecord, reviewItemId: reviewId, approvedByUserId: request.auth.uid, approvedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  batch.update(reviewRef, { status: "approved", targetId: targetRef.id, resolvedByUserId: request.auth.uid, resolvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  logger.info("CRM AI suggestion approved", { reviewId, targetId: targetRef.id, kind: reviewData.kind, workspaceId: ownership.workspaceId });
  return { reviewId, targetId: targetRef.id, status: "approved" };
}));

export const rejectCrmReviewItem = onCall(withCallErrorHandling(async (request: any, logger: any) => {
  const ownership = requireApproved(request);
  const db = getFirestore();
  const reviewId = String(request.data?.reviewId || "");
  const reviewRef = db.collection("crm_review_items").doc(reviewId);
  const reviewSnapshot = await reviewRef.get();
  const review = reviewSnapshot.data();
  if (!reviewSnapshot.exists || review?.workspaceId !== ownership.workspaceId) throw new HttpsError("not-found", "Sugestão não encontrada.");
  const reviewData = review as Record<string, any>;
  if (reviewData.status !== "pending") throw new HttpsError("failed-precondition", "Esta sugestão já foi revisada.");
  await reviewRef.update({ status: "rejected", rejectionReason: String(request.data?.reason || "Rejeitada pela equipe"), resolvedByUserId: request.auth.uid, resolvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  logger.info("CRM AI suggestion rejected", { reviewId, kind: reviewData.kind, workspaceId: ownership.workspaceId });
  return { reviewId, status: "rejected" };
}));
