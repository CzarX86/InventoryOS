import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onRequest, onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { WHATSAPP_TRANSACTION_EXTRACTION_PROMPT } from "./whatsappTransactionPrompt";
import { planAiTask, executeAiTask } from "./aiTaskPlanner";
import { WHATSAPP_COLLECTIONS, createWhatsappExtractedTransactionRecord } from "./whatsappDomain";

admin.initializeApp();

/**
 * Helper to ensure user is an admin for onCall functions.
 */
async function ensureAdmin(auth: any) {
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
async function evolutionProxy(method: string, path: string, body: any = null, timeoutMs = 20000): Promise<{ status: number; data: any }> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new HttpsError("failed-precondition", "Evolution API not configured");
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    signal: controller.signal,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${apiUrl}${path}`, options);
    clearTimeout(id);
    
    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      logger.error("Evolution API Non-JSON Response", { status: response.status, text: text.slice(0, 500), path });
      throw new HttpsError("internal", `API returned non-JSON response (${response.status})`);
    }

    const data = await response.json();
    return { status: response.status, data };
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === "AbortError") {
      logger.error("Evolution API Timeout", { timeoutMs, path });
      throw new HttpsError("deadline-exceeded", `Timeout communicating with Evolution API after ${timeoutMs}ms`);
    }
    logger.error("Evolution API Proxy Error", { error: error.message, path });
    // Re-throw if it's already an HttpsError, otherwise wrap it
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", `Error communicating with Evolution API: ${error.message}`);
  }
}

const PROJECT_PREFIX = "ios_";

/**
 * Proxy: List all instances
 */
export const listWhatsappInstances = onCall({
  secrets: ["EVOLUTION_API_URL", "EVOLUTION_API_KEY"],
}, async (request: CallableRequest) => {
  await ensureAdmin(request.auth);
  
  let result;
  try {
    result = await evolutionProxy("GET", "/instance/fetchInstances", null, 15000);
  } catch (err: any) {
    logger.error("Falha fatal ao listar instâncias", { error: err.message });
    throw err;
  }
  
  if (result.status === 200 && Array.isArray(result.data)) {
    // 1. Filtrar e mapear instâncias básicas
    const instances = result.data
      .filter((inst: any) => {
        const name = inst?.instance?.instanceName || inst?.name || inst?.instanceName;
        return name && (name.startsWith(PROJECT_PREFIX) || name.includes("inventory_os"));
      })
      .map((inst: any) => {
        // Normalizar nome e conexão
        const name = inst?.instance?.instanceName || inst?.name || inst?.instanceName;
        const connectionStatus = inst?.instance?.status || inst?.connectionStatus || inst?.status;
        return { ...inst, name, connectionStatus };
      });

    // 2. Buscar status detalhado (bateria, plataforma) para instâncias "open"
    // Limitamos a concorrência e o timeout por item para não travar a lista toda
    const updatedData = await Promise.all(instances.map(async (inst: any) => {
      if (inst.connectionStatus === "open") {
        try {
          const stateResult = await evolutionProxy("GET", `/instance/connectionState/${inst.name}`, null, 10000);
          
          // Debugging log to see the real structure
          logger.info("Evolution connectionState result", { instance: inst.name, data: JSON.stringify(stateResult.data) });

          if (stateResult.status === 200 && stateResult.data) {
            // Check common paths for both v1 and v2
            const instanceData = stateResult.data.instance || stateResult.data;
            return {
              ...inst,
              battery: instanceData.batteryLevel ?? instanceData.battery ?? inst.instance?.batteryLevel ?? null,
              platform: instanceData.platform ?? inst.instance?.platform ?? null
            };
          }
        } catch (err: any) {
          logger.warn("Falha ao buscar status detalhado para instância", { name: inst.name, error: err.message });
        }
      }
      return inst;
    }));

    result.data = updatedData;
  }
  
  return result;
});

/**
 * Proxy: Create a new instance
 */
export const createWhatsappInstance = onCall({
  secrets: ["EVOLUTION_API_URL", "EVOLUTION_API_KEY"],
}, async (request: CallableRequest) => {
  await ensureAdmin(request.auth);
  const { instanceName } = request.data;
  if (!instanceName) {
    throw new HttpsError("invalid-argument", "instanceName is required");
  }

  // Garantir prefixo para isolamento de projeto
  const finalName = instanceName.startsWith(PROJECT_PREFIX) ? instanceName : `${PROJECT_PREFIX}${instanceName}`;

  return await evolutionProxy("POST", "/instance/create", {
    instanceName: finalName,
    token: crypto.randomBytes(16).toString("hex"),
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
  });
});

/**
 * Proxy: Get QR Code
 */
export const getWhatsappQrCode = onCall({
  secrets: ["EVOLUTION_API_URL", "EVOLUTION_API_KEY"],
}, async (request: CallableRequest) => {
  await ensureAdmin(request.auth);
  const { instanceName } = request.data;
  return await evolutionProxy("GET", `/instance/connect/${instanceName}`);
});

/**
 * Proxy: Logout instance
 */
export const logoutWhatsappInstance = onCall({
  secrets: ["EVOLUTION_API_URL", "EVOLUTION_API_KEY"],
}, async (request: CallableRequest) => {
  await ensureAdmin(request.auth);
  const { instanceName } = request.data;
  return await evolutionProxy("DELETE", `/instance/logout/${instanceName}`);
});

/**
 * Proxy: Delete instance
 */
export const deleteWhatsappInstance = onCall({
  secrets: ["EVOLUTION_API_URL", "EVOLUTION_API_KEY"],
}, async (request: CallableRequest) => {
  await ensureAdmin(request.auth);
  const { instanceName } = request.data;
  return await evolutionProxy("DELETE", `/instance/delete/${instanceName}`);
});

/**
 * Proxy: Set Webhook
 */
export const setWhatsappWebhook = onCall({
  secrets: ["EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_WEBHOOK_SECRET"],
}, async (request: CallableRequest) => {
  await ensureAdmin(request.auth);
  const { instanceName } = request.data;
  const webhookUrl = `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/evolutionWebhook`;
  
  return await evolutionProxy("POST", `/webhook/set/${instanceName}`, {
    webhook: {
      url: webhookUrl,
      enabled: true,
      secret: process.env.EVOLUTION_WEBHOOK_SECRET || "default_secret",
      headers: {
        Authorization: `Bearer ${process.env.EVOLUTION_WEBHOOK_SECRET || "default_secret"}`
      },
      webhook_by_events: true, // keep for compat with older versions
      webhookByEvents: true, // add for v2
      events: [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "MESSAGES_DELETE",
        "SEND_MESSAGE",
        "CONTACTS_UPSERT",
        "CONTACTS_UPDATE",
        "PRESENCE_UPDATE",
        "CHATS_UPSERT",
        "CHATS_UPDATE",
        "CHATS_DELETE",
        "GROUPS_UPSERT",
        "GROUPS_UPDATE",
        "GROUP_PARTICIPANTS_UPDATE",
        "CONNECTION_UPDATE",
        "CALL",
      ],
    }
  });
});

/**
 * Monitor: List recent WhatsApp events
 */
export const getWhatsappEvents = onCall(async (request: CallableRequest) => {
  await ensureAdmin(request.auth);
  
  const db = getFirestore();
  const eventsSnap = await db.collection("whatsapp_webhook_events")
    .orderBy("occurredAt", "desc")
    .limit(10)
    .get();
  return eventsSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      occurredAt: data.occurredAt && data.occurredAt.toDate ? data.occurredAt.toDate().toISOString() : data.occurredAt,
      receivedAt: data.receivedAt && data.receivedAt.toDate ? data.receivedAt.toDate().toISOString() : data.receivedAt
    };
  });
});

function sanitizeText(value: any, max = 140) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Verifies HMAC signature for Evolution API webhooks.
 */
function verifySignature(rawBody: Buffer, signature: string, secret: string) {
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
export const evolutionWebhook = onRequest({
  secrets: ["EVOLUTION_WEBHOOK_SECRET"],
}, async (req: any, res: any) => {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  const signature = req.headers["x-hub-signature-256"] || req.headers["x-evolution-signature"];
  
  // Verify signature
  let isSignatureValid = false;
  
  if (!secret) {
    isSignatureValid = true;
  } else {
    // 1. Check if the secret is just passed directly in a header
    if (
      req.headers["apikey"] === secret ||
      req.headers["authorization"] === `Bearer ${secret}` ||
      req.headers["x-webhook-secret"] === secret
    ) {
      isSignatureValid = true;
    } else {
      // 2. Fallback to HMAC validation
      isSignatureValid = verifySignature(req.rawBody, signature as string, secret);
    }
  }

  if (!isSignatureValid) {
    logger.warn(`Invalid webhook signature rejected. Candidate: ${signature}. Headers: ${JSON.stringify(req.headers)}`);
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
  } catch (error: any) {
    logger.error("Error storing webhook event", { error: error.message, eventId });
    res.status(500).send("Internal Server Error");
  }
});

/**
 * Fetches all groups from the Evolution API and populates the whatsapp_groups cache.
 */
export const syncWhatsappGroups = onCall({
  secrets: ["EVOLUTION_API_URL", "EVOLUTION_API_KEY"],
}, async (request: CallableRequest) => {
  const { instanceName } = request.data;
  if (!instanceName) {
    throw new HttpsError("invalid-argument", "Nome da instância é obrigatório.");
  }

  const db = getFirestore();

  try {
    const response = await evolutionProxy("GET", `/group/findAll/${instanceName}`, null, 30000);
    
    if (response.status !== 200) {
      throw new Error(`Evolution API error: ${response.status}`);
    }

    const groups = response.data || [];
    const batch = db.batch();
    let count = 0;

    for (const group of groups) {
      if (!group.id || (!group.subject && !group.name)) continue;
      
      const groupRef = db.collection("whatsapp_groups").doc(group.id);
      batch.set(groupRef, {
        id: group.id,
        name: group.subject || group.name,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      count++;
      
      // Batch limit is 500
      if (count % 400 === 0) {
        await batch.commit();
      }
    }

    if (count % 400 !== 0 && count > 0) {
      await batch.commit();
    }

    logger.info("WhatsApp groups synced", { instanceName, count });
    return { status: 200, message: `${count} grupos sincronizados.`, count };
  } catch (error: any) {
    logger.error("Error syncing WhatsApp groups", { error: error.message || error, instanceName });
    throw new HttpsError("internal", error.message || "Erro desconhecido na sincronização");
  }
});

/**
 * Trigger to process stored WhatsApp events.
 * Extracts messages and links lineage.
 */
export const processWhatsappEvent = onDocumentCreated("whatsapp_webhook_events/{eventId}", async (event: any) => {
  const eventData = event.data?.data();
  if (!eventData) return;

  const db = getFirestore();
  const payload = eventData.payload;
  const data = payload.data;

  // 1. Handle Group Metadata Caching
  if (eventData.eventType === "groups.upsert" || eventData.eventType === "groups.update") {
    const groupId = data?.id;
    const groupName = data?.subject || data?.name;
    if (groupId && groupName) {
      await db.collection("whatsapp_groups").doc(groupId).set({
        id: groupId,
        name: groupName,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      logger.info("Group metadata cached", { groupId, groupName });
    }
  }

  // 2. Handle Message Processing
  if (eventData.eventType !== "messages.upsert") {
    return;
  }

  const message = data?.message;
  if (!message) return;

  const text = message.conversation || 
               message.extendedTextMessage?.text || 
               message.imageMessage?.caption || 
               "";

  if (!text && !message.imageMessage) return;

  const messageId = data.key.id;

  try {
    const remoteJid = data.key.remoteJid;
    const isGroup = remoteJid?.endsWith("@g.us");
    let groupName = payload.data?.groupContext?.groupName || payload.data?.sender?.name || null;

    // If not in payload, try look up in cache
    if (isGroup && !groupName) {
      const groupDoc = await db.collection("whatsapp_groups").doc(remoteJid).get();
      if (groupDoc.exists) {
        groupName = groupDoc.data()?.name;
      }

      // 1. Fallback: Lookup via Evolution API findGroupInfos if still not found
      if (!groupName && eventData.instanceId) {
        try {
          const groupInfoRes = await evolutionProxy(
            "GET", 
            `/group/findGroupInfos/${eventData.instanceId}?groupJid=${remoteJid}`, 
            null, 
            15000
          );
          if (groupInfoRes.status === 200 && (groupInfoRes.data?.subject || groupInfoRes.data?.name)) {
            groupName = groupInfoRes.data.subject || groupInfoRes.data.name;
            
            // Save to cache for future
            await db.collection("whatsapp_groups").doc(remoteJid).set({
              id: remoteJid,
              name: groupName,
              updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
            logger.info("Group metadata retrieved from API and cached", { groupId: remoteJid, groupName });
          }
        } catch (fallbackErr: any) {
          logger.warn("Failed to fetch group info fallback", { groupId: remoteJid, error: fallbackErr.message });
        }
      }
    }

    // 2. Maintain Review Queue collection
    const collectionName = isGroup ? "whatsapp_groups" : "whatsapp_contacts";
    const contactRef = db.collection(collectionName).doc(remoteJid);
    const contactDoc = await contactRef.get();
    
    const contactUpdate: any = {
      id: remoteJid,
      name: isGroup ? groupName : (data.pushName || "Desconhecido"),
      updatedAt: FieldValue.serverTimestamp(),
      lastMessageAt: FieldValue.serverTimestamp(),
    };
    
    if (!contactDoc.exists) {
      contactUpdate.monitoringStatus = "pending_review";
    }
    
    await contactRef.set(contactUpdate, { merge: true });
    const messageDoc = {
      providerMessageId: messageId,
      remoteJid,
      pushName: data.pushName || "Desconhecido",
      groupName,
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
  } catch (error: any) {
    logger.error("Error processing WhatsApp message", { error: error.message, eventId: event.params.eventId });
    await db.collection("whatsapp_webhook_events").doc(event.params.eventId).update({
      status: "failed",
      errorMessage: error.message,
    });
  }
});

async function resolvePrimaryAdminUid(db: FirebaseFirestore.Firestore) {
  const supportDoc = await db.collection("system").doc("support").get();
  if (supportDoc.exists && supportDoc.data()?.primaryAdminUid) {
    return supportDoc.data()?.primaryAdminUid;
  }

  const adminsSnap = await db.collection("users").where("role", "==", "admin").limit(2).get();
  if (adminsSnap.size === 1) {
    return adminsSnap.docs[0].id;
  }

  return null;
}

export const notifyAdminOnSupportTicket = onDocumentCreated("support_tickets/{ticketId}", async (event: any) => {
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

  const errorReport = errorSnap.data() as any;
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

  const tokens = tokenSnap.docs.map((doc: any) => doc.data().token).filter(Boolean);
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

  const invalidDocs: FirebaseFirestore.DocumentReference[] = [];
  response.responses.forEach((result: any, index: number) => {
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
export const onWhatsappMessageCreated = onDocumentCreated({
  document: "whatsapp_messages/{messageId}",
  secrets: ["GEMINI_API_KEY", "DEEPSEEK_API_KEY"]
}, async (event: any) => {
  const messageId = event.params.messageId;
  const messageData = event.data?.data();

  // Only process incoming text messages that haven't been extracted yet
  if (!messageData || messageData.fromMe || messageData.type !== "text" || messageData.extracted) {
    return;
  }

  // Very basic Relevance Filter: ignore purely empty messages.
  // We no longer discard short messages (like "10x" or "sim"), 
  // as they can be highly relevant in a conversational context.
  const trimmedText = (messageData.text as string).trim();
  if (!trimmedText) {
    return;
  }

  const db = getFirestore();

  // 1. Relevance Filter - Check monitoring status (Layer 0)
  // Check if contact/group is actively monitored. If not, don't waste AI tokens.
  const remoteJid = messageData.remoteJid;
  if (remoteJid) {
    const isGroup = remoteJid.endsWith("@g.us");
    const collectionName = isGroup ? "whatsapp_groups" : "whatsapp_contacts";
    const contactDoc = await db.collection(collectionName).doc(remoteJid).get();
    
    // Default to 'pending_review' if not set. Only 'active' triggers AI.
    const monitoringStatus = contactDoc.exists ? (contactDoc.data()?.monitoringStatus || 'pending_review') : 'pending_review';
    
    // For now, if someone wants to test, they must set monitoringStatus to 'active' manually or via the new UI
    if (monitoringStatus !== 'active') {
      logger.info("Message ignored by relevance filter: Contact not actively monitored", { messageId, remoteJid, monitoringStatus });
      
      // Update message to show it was skipped due to relevance filter
      await db.collection("whatsapp_messages").doc(messageId).update({
        extracted: "skipped",
        extractionReason: "not_monitored",
        updatedAt: FieldValue.serverTimestamp()
      });
      return;
    }
  }

  // If we made it here, the contact is monitored. Mark message for batch processing.
  await db.collection("whatsapp_messages").doc(messageId).update({
    extracted: "pending_batch",
    updatedAt: FieldValue.serverTimestamp()
  });

  logger.info("Message queued for batch AI processing", { messageId, remoteJid });
});

/**
 * Core logic for batching whatsapp messages per contact and extracting transactions
 */
async function processPendingWhatsappBatches() {
  const db = getFirestore();
  const pendingMessagesSnap = await db.collection("whatsapp_messages")
    .where("extracted", "in", ["pending_batch", "waiting_context"])
    .orderBy("timestamp", "asc")
    .get();

  if (pendingMessagesSnap.empty) {
    logger.info("No pending messages for batch processing");
    return { count: 0 };
  }

  // Group by remoteJid
  const messagesByJid: Record<string, any[]> = {};
  pendingMessagesSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    if (!messagesByJid[data.remoteJid]) {
      messagesByJid[data.remoteJid] = [];
    }
    messagesByJid[data.remoteJid].push({ id: doc.id, ...data });
  });



  let processedCount = 0;
  const now = Date.now();
  const COOLDOWN_MINUTES = 3;
  const COOLDOWN_MS = COOLDOWN_MINUTES * 60 * 1000;

  // Process each group
  for (const [remoteJid, messages] of Object.entries(messagesByJid)) {
     // Rule: Skip if there are NO new messages (all are just 'waiting_context')
     // This prevents re-processing the same incomplete context over and over.
     const hasNewMessages = messages.some((m: any) => m.extracted === "pending_batch");
     if (!hasNewMessages) {
       continue;
     }

     const lastMessage = messages[messages.length - 1];
     const lastMessageTime = lastMessage.timestamp?.toMillis ? lastMessage.timestamp.toMillis() : (lastMessage.timestamp instanceof Date ? lastMessage.timestamp.getTime() : now);
     
     // Sliding Window: If the last message was sent less than 3 minutes ago, do not extract yet.
     if (now - lastMessageTime < COOLDOWN_MS) {
       logger.info("Batch skipped due to active cooldown", { remoteJid });
       continue;
     }

     // Concatenate messages with timestamp and pushName for context
     const combinedText = messages.map((m: any) => `[${m.timestamp?.toDate ? m.timestamp.toDate().toISOString() : m.timestamp}] ${m.pushName || 'User'}: ${m.text}`).join("\n");
     
     try {
       // 1. Plan AI Task
       const plan = await planAiTask(
         "whatsapp_batch_extraction", 
         remoteJid, 
         { 
           targetType: "whatsapp_chat_batch",
           metadata: { messageCount: messages.length, combinedText } 
         }
       );

       // 2. Execute AI
       // Modifying prompt structure to handle multiple lines/context if necessary
       const prompt = WHATSAPP_TRANSACTION_EXTRACTION_PROMPT.replace("{{messageText}}", combinedText);
       const runResult = await executeAiTask(plan, prompt);

       if (runResult.status !== "completed") {
         throw new Error(runResult.errorMessage || "AI Batch Execution Failed");
       }

       const extractedData = runResult.output;

       // 3. Save Extracted Transaction
       const extractionRef = db.collection(WHATSAPP_COLLECTIONS.whatsappExtractedTransactions).doc();
       const extractionRecord = createWhatsappExtractedTransactionRecord({
         messageId: messages[messages.length - 1].id, // Use the last message as anchor
         remoteJid: remoteJid,
         operation: extractedData.operation,
         items: extractedData.items,
         grandTotal: extractedData.grandTotal,
         confidence: extractedData.confidence,
         summary: extractedData.summary,
         lineage: {
           aiRunId: runResult.runId,
           model: runResult.model,
           batchMessageIds: messages.map((m: any) => m.id) // Track all messages that went into this extraction
         }
       });

       await extractionRef.set(extractionRecord);

       // 4. Update Messages in Batch based on completeness
       const batch = db.batch();
       const nextStatus = extractedData.isConversationComplete ? true : "waiting_context";
       
       messages.forEach((m: any) => {
         const msgRef = db.collection("whatsapp_messages").doc(m.id);
         batch.update(msgRef, {
           extracted: nextStatus,
           extractionId: extractionRef.id,
           batchProcessedAt: FieldValue.serverTimestamp(),
           completenessReason: extractedData.completenessReason || null
         });
         
         // Sync back to webhooks monitor
         if (m.lineage && m.lineage.rawSourceEventId) {
           const webhookRef = db.collection("whatsapp_webhook_events").doc(m.lineage.rawSourceEventId);
           batch.update(webhookRef, {
              aiClassification: extractedData.operation || "BATCH_CLASSIFIED",
              aiExtractionStatus: nextStatus === true ? "processed" : "partial",
              aiSummary: `Batch extraction (${nextStatus}): ${extractedData.summary || 'done'}`,
              updatedAt: FieldValue.serverTimestamp()
           });
         }
       });

       await batch.commit();
       processedCount += messages.length;
       logger.info("Processed whatsapp batch", { remoteJid, complete: extractedData.isConversationComplete, count: messages.length });
     } catch (error: any) {
       logger.error("Failed to process whatsapp batch", { error: error.message, remoteJid });
       
       // Mark as failed so it doesn't stay pending forever, or we could leave it to retry later?
       // It's safer to mark them as failed so the queue progresses.
       const batch = db.batch();
       messages.forEach((m: any) => {
         const msgRef = db.collection("whatsapp_messages").doc(m.id);
         batch.update(msgRef, {
           extracted: "failed",
           extractionError: error.message,
           updatedAt: FieldValue.serverTimestamp()
         });
       });
       await batch.commit();
     }
  }

  return { count: processedCount, groups: Object.keys(messagesByJid).length };
}

/**
 * Scheduled CRON job to process WhatsApp message buffers
 */
export const scheduledWhatsappBatchProcess = onSchedule({
  schedule: "every 20 minutes",
  secrets: ["GEMINI_API_KEY", "DEEPSEEK_API_KEY"]
}, async (event: ScheduledEvent) => {
  logger.info("Starting scheduled whatsapp batch process");
  await processPendingWhatsappBatches();
});

/**
 * Manual trigger for testing the batch processing
 */
export const triggerWhatsappBatch = onCall({
  secrets: ["GEMINI_API_KEY", "DEEPSEEK_API_KEY"]
}, async (request: CallableRequest) => {
  await ensureAdmin(request.auth);
  logger.info("Manual trigger for whatsapp batch process");
  return await processPendingWhatsappBatches();
});

// FinOps - Real-time aggregated usage monitoring
import { aggregateAiUsage } from "./finops";
export { aggregateAiUsage };
