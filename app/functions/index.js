const admin = require("firebase-admin");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");

admin.initializeApp();

function sanitizeText(value, max = 140) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function resolvePrimaryAdminUid(db) {
  const supportDoc = await db.collection("system").doc("support").get();
  if (supportDoc.exists && supportDoc.data()?.primaryAdminUid) {
    return supportDoc.data().primaryAdminUid;
  }

  const adminsSnap = await db.collection("users").where("role", "==", "admin").limit(2).get();
  if (adminsSnap.size === 1) {
    return adminsSnap.docs[0].id;
  }

  return null;
}

exports.notifyAdminOnSupportTicket = onDocumentCreated("support_tickets/{ticketId}", async (event) => {
  const db = admin.firestore();
  const ticketId = event.params.ticketId;
  const ticket = event.data?.data();

  if (!ticket) {
    logger.warn("Support ticket missing payload", { ticketId });
    return;
  }

  const errorRef = db.collection("error_reports").doc(ticket.errorId);
  const errorSnap = await errorRef.get();
  if (!errorSnap.exists) {
    logger.warn("Error report not found for ticket", { ticketId, errorId: ticket.errorId });
    return;
  }

  const errorReport = errorSnap.data();
  const assignedAdminId = ticket.assignedAdminId || await resolvePrimaryAdminUid(db);
  if (!assignedAdminId) {
    logger.warn("No primary admin resolved for support ticket", { ticketId });
    await db.collection("support_tickets").doc(ticketId).set({
      notificationStatus: "no-admin",
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }

  const tokenSnap = await db.collection("admin_device_tokens")
    .where("userId", "==", assignedAdminId)
    .where("enabled", "==", true)
    .get();

  if (tokenSnap.empty) {
    logger.warn("No admin device token found", { ticketId, assignedAdminId });
    await db.collection("support_tickets").doc(ticketId).set({
      assignedAdminId,
      notificationStatus: "no-device-token",
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }

  const tokens = tokenSnap.docs.map((doc) => doc.data().token).filter(Boolean);
  const payload = {
    notification: {
      title: `Erro reportado: ${sanitizeText(errorReport.action, 50)}`,
      body: sanitizeText(errorReport.humanMessage || "Abra o painel admin para detalhes.", 120),
    },
    data: {
      ticketId,
      errorId: errorReport.errorId,
      action: String(errorReport.action || ""),
      severity: String(errorReport.severity || "medium"),
      route: "/?tab=ADMIN",
    },
  };

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    ...payload,
  });

  const invalidDocs = [];
  response.responses.forEach((result, index) => {
    if (!result.success) {
      const code = result.error?.code || "";
      if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
        invalidDocs.push(tokenSnap.docs[index].ref);
      }
      logger.error("Push send failed", { ticketId, code });
    }
  });

  await Promise.all(invalidDocs.map((ref) => ref.delete()));

  await db.collection("support_tickets").doc(ticketId).set({
    assignedAdminId,
    notificationStatus: response.failureCount > 0 ? "partial" : "sent",
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await errorRef.set({
    adminNotified: response.successCount > 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
});
