export const WHATSAPP_COLLECTIONS = Object.freeze({
  whatsappInstances: "whatsapp_instances",
  whatsappWebhookEvents: "whatsapp_webhook_events",
  whatsappExtractedTransactions: "whatsapp_extracted_transactions",
  historyBackfillJobs: "history_backfill_jobs",
  txtImportJobs: "txt_import_jobs",
  messageDispatchJobs: "message_dispatch_jobs",
});

export const WHATSAPP_INSTANCE_STATUSES = Object.freeze([
  "pending",
  "active",
  "paused",
  "disconnected",
  "error",
]);

export const WHATSAPP_EVENT_STATUSES = Object.freeze([
  "pending",
  "processing",
  "processed",
  "ignored",
  "failed",
]);

export const HISTORY_BACKFILL_JOB_STATUSES = Object.freeze([
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);

function applyOwnershipContext(payload: any = {}, context: any = {}) {
  return {
    ...payload,
    ownerId: context?.ownerId || null,
    accountId: payload?.accountId || context?.defaultAccountId || null,
  };
}

function buildBaseRecord(type: string, payload: any = {}, ownershipContext: any = {}) {
  return {
    type,
    ...applyOwnershipContext(payload, ownershipContext),
  };
}

function normalizeIsoString(value: any) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function buildBackfillBucketKey(value: any) {
  const isoValue = normalizeIsoString(value);
  if (!isoValue) return null;
  return isoValue.slice(0, 10);
}

export function buildHistoryCutoffIso(targetDate: any) {
  const bucketKey = buildBackfillBucketKey(targetDate);
  if (!bucketKey) return null;
  return `${bucketKey}T23:59:59.999Z`;
}

export function buildWebhookEventDedupKey({
  provider = "evolution",
  instanceId = "unknown-instance",
  eventType = "UNKNOWN_EVENT",
  externalEventId = null as string | null,
  occurredAt = null as any,
} = {}) {
  const stableTail = externalEventId || normalizeIsoString(occurredAt) || "no-external-id";
  return [provider, instanceId, eventType, stableTail].join(":");
}

function normalizeQueueContactEntry(entry: any = {}, index = 0) {
  return {
    queueIndex: index,
    contactId: entry.contactId || null,
    conversationId: entry.conversationId || null,
    displayName: entry.displayName || null,
    phoneNumber: entry.phoneNumber || null,
    sourceLastInteractionAt: normalizeIsoString(entry.sourceLastInteractionAt),
    status: entry.status || "pending",
    attempts: Number(entry.attempts) || 0,
    startedAt: normalizeIsoString(entry.startedAt),
    completedAt: normalizeIsoString(entry.completedAt),
    failedAt: normalizeIsoString(entry.failedAt),
    digestId: entry.digestId || null,
    errorCode: entry.errorCode || null,
    errorMessage: entry.errorMessage || null,
  };
}

function recalculateBackfillCheckpoint(queueContacts: any[] = []) {
  const completedCount = queueContacts.filter((entry) => entry.status === "completed").length;
  const failedCount = queueContacts.filter((entry) => entry.status === "failed").length;
  const nextPending = queueContacts.find((entry) => entry.status === "pending");
  const activeEntry = queueContacts.find((entry) => entry.status === "running");

  return {
    completedCount,
    failedCount,
    totalCount: queueContacts.length,
    cursorContactId: activeEntry?.contactId || nextPending?.contactId || null,
    lastCompletedContactId:
      [...queueContacts].reverse().find((entry) => entry.status === "completed")?.contactId || null,
  };
}

function deriveBackfillJobStatus(queueContacts: any[] = [], fallbackStatus = "pending") {
  if (queueContacts.length === 0) return fallbackStatus;
  if (queueContacts.some((entry) => entry.status === "running")) return "running";
  if (queueContacts.every((entry) => ["completed", "failed"].includes(entry.status))) return "completed";
  return fallbackStatus;
}

function updateBackfillQueueContact(job: any, contactId: string, updater: (entry: any) => any) {
  const nextQueue = (job.queueContacts || []).map((entry: any) => (
    entry.contactId === contactId ? updater(entry) : entry
  ));
  const nextStatus = deriveBackfillJobStatus(nextQueue, job.status || "pending");

  return {
    ...job,
    queueContacts: nextQueue,
    status: nextStatus,
    checkpoint: recalculateBackfillCheckpoint(nextQueue),
  };
}

export function createWhatsappInstanceRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("whatsapp_instance", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    provider: payload.provider || "evolution",
    instanceKey: payload.instanceKey || null,
    instanceName: payload.instanceName || payload.instanceKey || null,
    status: payload.status || "active",
    phoneNumber: payload.phoneNumber || null,
    displayName: payload.displayName || null,
    webhookUrl: payload.webhookUrl || null,
    metadata: payload.metadata || {},
    connectedAt: normalizeIsoString(payload.connectedAt),
    disconnectedAt: normalizeIsoString(payload.disconnectedAt),
  }, ownershipContext);
}

export function createWhatsappWebhookEventRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("whatsapp_webhook_event", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    provider: payload.provider || "evolution",
    instanceId: payload.instanceId || null,
    instanceKey: payload.instanceKey || null,
    eventType: payload.eventType || "UNKNOWN_EVENT",
    externalEventId: payload.externalEventId || null,
    dedupKey: payload.dedupKey || buildWebhookEventDedupKey(payload),
    status: payload.status || "pending",
    occurredAt: normalizeIsoString(payload.occurredAt),
    receivedAt: normalizeIsoString(payload.receivedAt),
    payload: payload.payload || {},
    metadata: payload.metadata || {},
    errorCode: payload.errorCode || null,
    errorMessage: payload.errorMessage || null,
  }, ownershipContext);
}

export function createHistoryBackfillJobRecord(payload: any = {}, ownershipContext: any = {}) {
  const targetDate = buildBackfillBucketKey(payload.targetDate);
  const queueContacts = (payload.queueContacts || []).map(normalizeQueueContactEntry);

  return buildBaseRecord("history_backfill_job", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    targetDate,
    dateBucketKey: targetDate,
    cutoffAt: buildHistoryCutoffIso(targetDate),
    status: payload.status || "pending",
    processingMode: "full_relationship_until_bucket_date",
    queueContacts,
    checkpoint: recalculateBackfillCheckpoint(queueContacts),
    source: payload.source || "whatsapp_history_backfill",
    provider: payload.provider || "evolution",
    metadata: payload.metadata || {},
    startedAt: normalizeIsoString(payload.startedAt),
    completedAt: normalizeIsoString(payload.completedAt),
  }, ownershipContext);
}

export function getNextBackfillQueueContact(job: any = {}) {
  return (job.queueContacts || []).find((entry: any) => entry.status === "pending") || null;
}

export function markBackfillContactAttempt(job: any = {}, contactId: string, metadata: any = {}) {
  return updateBackfillQueueContact(job, contactId, (entry) => ({
    ...entry,
    status: "running",
    attempts: (entry.attempts || 0) + 1,
    startedAt: normalizeIsoString(metadata.startedAt) || entry.startedAt || null,
    failedAt: null,
    errorCode: null,
    errorMessage: null,
  }));
}

export function markBackfillContactCompleted(job: any = {}, contactId: string, metadata: any = {}) {
  return updateBackfillQueueContact(job, contactId, (entry) => ({
    ...entry,
    status: "completed",
    completedAt: normalizeIsoString(metadata.completedAt) || entry.completedAt || null,
    digestId: metadata.digestId || entry.digestId || null,
    errorCode: null,
    errorMessage: null,
  }));
}

export function markBackfillContactFailed(job: any = {}, contactId: string, metadata: any = {}) {
  return updateBackfillQueueContact(job, contactId, (entry) => ({
    ...entry,
    status: "failed",
    failedAt: normalizeIsoString(metadata.failedAt) || entry.failedAt || null,
    errorCode: metadata.errorCode || entry.errorCode || null,
    errorMessage: metadata.errorMessage || entry.errorMessage || null,
  }));
}

export function createTxtImportJobRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("txt_import_job", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    contactId: payload.contactId || null,
    conversationId: payload.conversationId || null,
    provider: payload.provider || "whatsapp_export",
    status: payload.status || "pending",
    fileName: payload.fileName || null,
    storagePath: payload.storagePath || null,
    detectedGapReason: payload.detectedGapReason || null,
    metadata: payload.metadata || {},
  }, ownershipContext);
}

export function createMessageDispatchJobRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("message_dispatch_job", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    contactId: payload.contactId || null,
    conversationId: payload.conversationId || null,
    channelType: payload.channelType || "whatsapp",
    provider: payload.provider || "whatsapp",
    messageTemplateType: payload.messageTemplateType || null,
    status: payload.status || "pending_approval",
    requiresApproval: payload.requiresApproval ?? true,
    estimatedCostUsd: payload.estimatedCostUsd ?? null,
    metadata: payload.metadata || {},
  }, ownershipContext);
}

/**
 * Normalizes a raw Evolution API payload into a standard message object.
 */
export function normalizeWhatsappMessage(payload: any) {
  if (!payload || payload.event !== "messages.upsert") return null;

  const data = payload.data;
  const message = data.message;
  if (!message) return null;

  const text = message.conversation || 
               message.extendedTextMessage?.text || 
               message.imageMessage?.caption || 
               "";

  if (!text && !message.imageMessage) return null;

  return {
    providerMessageId: data.key.id,
    remoteJid: data.key.remoteJid,
    pushName: data.pushName || "Desconhecido",
    text,
    timestamp: data.messageTimestamp ? new Date(data.messageTimestamp * 1000).toISOString() : new Date().toISOString(),
    fromMe: data.key.fromMe || false,
    type: message.imageMessage ? "image" : "text",
    lineage: {
      rawSourceEventId: payload.eventId || null,
    },
  };
}

export function createWhatsappExtractedTransactionRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("whatsapp_extracted_transaction", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    messageId: payload.messageId || null,
    remoteJid: payload.remoteJid || null,
    operation: payload.operation || "UNKNOWN",
    items: payload.items || [],
    grandTotal: payload.grandTotal || 0,
    confidence: payload.confidence || 0,
    summary: payload.summary || null,
    status: payload.status || "pending",
    lineage: payload.lineage || {},
    occurredAt: normalizeIsoString(payload.occurredAt) || new Date().toISOString(),
  }, ownershipContext);
}
