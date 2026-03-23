const admin = require("firebase-admin");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const crypto = require("crypto");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

admin.initializeApp();

/**
 * Helper to ensure user is an admin for onCall functions.
 */
async function ensureAdmin(auth) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const db = getFirestore();
  const userDoc = await db.collection("users").doc(auth.uid).get();
  
  if (!userDoc.exists || userDoc.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin role required");
  }
}

/**
 * Evolution API Proxy Helper
 */
async function evolutionProxy(method, path, body = null) {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new HttpsError("failed-precondition", "Evolution API not configured");
  }

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${apiUrl}${path}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    logger.error("Evolution API Proxy Error", { error: error.message, path });
    throw new HttpsError("internal", "Error communicating with Evolution API");
  }
}

/**
 * Proxy: List all instances
 */
exports.listWhatsappInstances = onCall(async (request) => {
  await ensureAdmin(request.auth);
  return await evolutionProxy("GET", "/instance/fetchInstances");
});

/**
 * Proxy: Create a new instance
 */
exports.createWhatsappInstance = onCall(async (request) => {
  await ensureAdmin(request.auth);
  const { instanceName } = request.data;
  if (!instanceName) {
    throw new HttpsError("invalid-argument", "instanceName is required");
  }

  return await evolutionProxy("POST", "/instance/create", {
    instanceName,
    token: crypto.randomBytes(16).toString("hex"),
    qrcode: true,
  });
});

/**
 * Proxy: Get QR Code
 */
exports.getWhatsappQrCode = onCall(async (request) => {
  await ensureAdmin(request.auth);
  const { instanceName } = request.data;
  return await evolutionProxy("GET", `/instance/connect/${instanceName}`);
});

/**
 * Proxy: Logout instance
 */
exports.logoutWhatsappInstance = onCall(async (request) => {
  await ensureAdmin(request.auth);
  const { instanceName } = request.data;
  return await evolutionProxy("DELETE", `/instance/logout/${instanceName}`);
});

/**
 * Proxy: Delete instance
 */
exports.deleteWhatsappInstance = onCall(async (request) => {
  await ensureAdmin(request.auth);
  const { instanceName } = request.data;
  return await evolutionProxy("DELETE", `/instance/delete/${instanceName}`);
});

/**
 * Proxy: Set Webhook
 */
exports.setWhatsappWebhook = onCall(async (request) => {
  await ensureAdmin(request.auth);
  const { instanceName } = request.data;
  const webhookUrl = process.env.PUBLIC_WEBHOOK_URL || `https://${process.env.GCLOUD_PROJECT}.web.app/evolutionWebhook`;
  
  return await evolutionProxy("POST", `/webhook/set/${instanceName}`, {
    url: webhookUrl,
    enabled: true,
    webhook_by_events: true,
    events: ["MESSAGES_UPSERT", "QRCODE_UPDATED", "CONNECTION_UPDATE"],
  });
});

function sanitizeText(value, max = 140) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Verifies HMAC signature for Evolution API webhooks.
 */
function verifySignature(rawBody, signature, secret) {
  if (!secret) return true; // Insecure mode for dev
  if (!signature) return false;

  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(rawBody).digest("hex");
  const candidate = signature.replace("sha256=", "").toLowerCase();
  
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(candidate));
}

/**
 * Webhook endpoint for Evolution API.
 */
exports.evolutionWebhook = onRequest(async (req, res) => {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  const signature = req.headers["x-hub-signature-256"] || req.headers["x-evolution-signature"];
  
  // Verify signature
  if (secret && !verifySignature(req.rawBody, signature, secret)) {
    logger.warn("Invalid webhook signature rejected");
    res.status(401).send("Unauthorized");
    return;
  }

  const payload = req.body;
  const eventType = payload.event || "UNKNOWN";
  const instanceId = payload.instance || "unknown";

  // Generate event ID (SHA256 of payload) to avoid duplicates
  const eventId = crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");

  try {
    const db = getFirestore();
    const eventRef = db.collection("whatsapp_webhook_events").doc(eventId);
    
    await eventRef.set({
      id: eventId,
      provider: "evolution",
      instanceId,
      eventType,
      payload,
      status: "pending",
      receivedAt: FieldValue.serverTimestamp(),
      occurredAt: payload.createdAt || FieldValue.serverTimestamp(),
    }, { merge: true });

    logger.info("Webhook event stored", { eventId, eventType });
    res.status(200).send({ ok: true, eventId });
  } catch (error) {
    logger.error("Error storing webhook event", { error: error.message, eventId });
    res.status(500).send("Internal Server Error");
  }
});

/**
 * Trigger to process stored WhatsApp events.
 * Extracts messages and links lineage.
 */
exports.processWhatsappEvent = onDocumentCreated("whatsapp_webhook_events/{eventId}", async (event) => {
  const eventData = event.data?.data();
  if (!eventData || eventData.eventType !== "messages.upsert") {
    return;
  }

  const payload = eventData.payload;
  const data = payload.data;
  const message = data?.message;

  if (!message) return;

  const text = message.conversation || 
               message.extendedTextMessage?.text || 
               message.imageMessage?.caption || 
               "";

  if (!text && !message.imageMessage) return;

  const db = getFirestore();
  const messageId = data.key.id;

  try {
    const messageDoc = {
      providerMessageId: messageId,
      remoteJid: data.key.remoteJid,
      pushName: data.pushName || "Desconhecido",
      text,
      fromMe: data.key.fromMe || false,
      timestamp: data.messageTimestamp ? new Date(data.messageTimestamp * 1000) : FieldValue.serverTimestamp(),
      type: message.imageMessage ? "image" : "text",
      lineage: {
        rawSourceEventId: event.params.eventId,
      },
      processedAt: FieldValue.serverTimestamp(),
    };

    await db.collection("whatsapp_messages").doc(messageId).set(messageDoc, { merge: true });
    
    // Mark event as processed
    await db.collection("whatsapp_webhook_events").doc(event.params.eventId).update({
      status: "processed",
      processedAt: FieldValue.serverTimestamp(),
    });

    logger.info("WhatsApp message processed and linked", { messageId, eventId: event.params.eventId });
  } catch (error) {
    logger.error("Error processing WhatsApp message", { error: error.message, eventId: event.params.eventId });
    await db.collection("whatsapp_webhook_events").doc(event.params.eventId).update({
      status: "failed",
      errorMessage: error.message,
    });
  }
});

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
  const db = getFirestore();
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
      lastUpdatedAt: FieldValue.serverTimestamp(),
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
      lastUpdatedAt: FieldValue.serverTimestamp(),
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
    lastUpdatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await errorRef.set({
    adminNotified: response.successCount > 0,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
});

/**
 * Trigger to automatically extract transactions from incoming WhatsApp messages.
 */
exports.onWhatsappMessageCreated = onDocumentCreated({
  document: "whatsapp_messages/{messageId}",
  secrets: ["GEMINI_API_KEY"]
}, async (event) => {
  const messageId = event.params.messageId;
  const messageData = event.data?.data();

  // Only process incoming text messages that haven't been extracted yet
  if (!messageData || messageData.fromMe || messageData.type !== "text" || messageData.extracted) {
    return;
  }

  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const { WHATSAPP_TRANSACTION_EXTRACTION_PROMPT } = require("./whatsappTransactionPrompt");
  const { WHATSAPP_COLLECTIONS, createWhatsappExtractedTransactionRecord } = require("./whatsappDomain");
  const { createAiRunRecord } = require("./aiRuns");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.error("GEMINI_API_KEY not configured");
    return;
  }

  const db = getFirestore();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    // 1. Create AI Run Record (Planning/Tracking)
    const aiRunRef = db.collection("ai_runs").doc();
    const aiRunRecord = createAiRunRecord({
      taskType: "whatsapp_transaction_extraction",
      targetType: "whatsapp_message",
      targetId: messageId,
      model: "gemini-1.5-flash",
      status: "running",
      metadata: { text: messageData.text }
    });
    await aiRunRef.set(aiRunRecord);

    // 2. Execute AI
    const prompt = WHATSAPP_TRANSACTION_EXTRACTION_PROMPT.replace("{{messageText}}", messageData.text);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Clean response text if it has markdown code blocks
    const jsonStr = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const extractedData = JSON.parse(jsonStr);

    // 3. Save Extracted Transaction
    const extractionRef = db.collection(WHATSAPP_COLLECTIONS.whatsappExtractedTransactions).doc();
    const extractionRecord = createWhatsappExtractedTransactionRecord({
      messageId,
      remoteJid: messageData.remoteJid,
      operation: extractedData.operation,
      items: extractedData.items,
      grandTotal: extractedData.grandTotal,
      confidence: extractedData.confidence,
      summary: extractedData.summary,
      lineage: {
        aiRunId: aiRunRef.id,
        model: "gemini-1.5-flash"
      }
    });
    await extractionRef.set(extractionRecord);

    // 4. Update Message and AI Run
    await db.collection("whatsapp_messages").doc(messageId).update({
      extracted: true,
      extractionId: extractionRef.id
    });

    await aiRunRef.update({
      status: "completed",
      completedAt: FieldValue.serverTimestamp()
    });

    logger.info("WhatsApp transaction extracted successfully", { messageId, extractionId: extractionRef.id });
  } catch (error) {
    logger.error("Error extracting transaction from WhatsApp message", { error: error.message, messageId });
    // Update status to failed
    await db.collection("whatsapp_messages").doc(messageId).update({
      extracted: "failed",
      extractionError: error.message
    });
  }
});
