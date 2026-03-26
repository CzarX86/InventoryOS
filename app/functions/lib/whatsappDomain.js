"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HISTORY_BACKFILL_JOB_STATUSES = exports.WHATSAPP_EVENT_STATUSES = exports.WHATSAPP_INSTANCE_STATUSES = exports.WHATSAPP_COLLECTIONS = void 0;
exports.buildBackfillBucketKey = buildBackfillBucketKey;
exports.buildHistoryCutoffIso = buildHistoryCutoffIso;
exports.buildWebhookEventDedupKey = buildWebhookEventDedupKey;
exports.createWhatsappInstanceRecord = createWhatsappInstanceRecord;
exports.createWhatsappWebhookEventRecord = createWhatsappWebhookEventRecord;
exports.createHistoryBackfillJobRecord = createHistoryBackfillJobRecord;
exports.getNextBackfillQueueContact = getNextBackfillQueueContact;
exports.markBackfillContactAttempt = markBackfillContactAttempt;
exports.markBackfillContactCompleted = markBackfillContactCompleted;
exports.markBackfillContactFailed = markBackfillContactFailed;
exports.createTxtImportJobRecord = createTxtImportJobRecord;
exports.createMessageDispatchJobRecord = createMessageDispatchJobRecord;
exports.normalizeWhatsappMessage = normalizeWhatsappMessage;
exports.createWhatsappExtractedTransactionRecord = createWhatsappExtractedTransactionRecord;
exports.WHATSAPP_COLLECTIONS = Object.freeze({
    whatsappInstances: "whatsapp_instances",
    whatsappWebhookEvents: "whatsapp_webhook_events",
    whatsappExtractedTransactions: "whatsapp_extracted_transactions",
    historyBackfillJobs: "history_backfill_jobs",
    txtImportJobs: "txt_import_jobs",
    messageDispatchJobs: "message_dispatch_jobs",
});
exports.WHATSAPP_INSTANCE_STATUSES = Object.freeze([
    "pending",
    "active",
    "paused",
    "disconnected",
    "error",
]);
exports.WHATSAPP_EVENT_STATUSES = Object.freeze([
    "pending",
    "processing",
    "processed",
    "ignored",
    "failed",
]);
exports.HISTORY_BACKFILL_JOB_STATUSES = Object.freeze([
    "pending",
    "running",
    "paused",
    "completed",
    "failed",
    "cancelled",
]);
function applyOwnershipContext(payload = {}, context = {}) {
    return {
        ...payload,
        ownerId: context?.ownerId || null,
        accountId: payload?.accountId || context?.defaultAccountId || null,
    };
}
function buildBaseRecord(type, payload = {}, ownershipContext = {}) {
    return {
        type,
        ...applyOwnershipContext(payload, ownershipContext),
    };
}
function normalizeIsoString(value) {
    if (!value)
        return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function buildBackfillBucketKey(value) {
    const isoValue = normalizeIsoString(value);
    if (!isoValue)
        return null;
    return isoValue.slice(0, 10);
}
function buildHistoryCutoffIso(targetDate) {
    const bucketKey = buildBackfillBucketKey(targetDate);
    if (!bucketKey)
        return null;
    return `${bucketKey}T23:59:59.999Z`;
}
function buildWebhookEventDedupKey({ provider = "evolution", instanceId = "unknown-instance", eventType = "UNKNOWN_EVENT", externalEventId = null, occurredAt = null, } = {}) {
    const stableTail = externalEventId || normalizeIsoString(occurredAt) || "no-external-id";
    return [provider, instanceId, eventType, stableTail].join(":");
}
function normalizeQueueContactEntry(entry = {}, index = 0) {
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
function recalculateBackfillCheckpoint(queueContacts = []) {
    const completedCount = queueContacts.filter((entry) => entry.status === "completed").length;
    const failedCount = queueContacts.filter((entry) => entry.status === "failed").length;
    const nextPending = queueContacts.find((entry) => entry.status === "pending");
    const activeEntry = queueContacts.find((entry) => entry.status === "running");
    return {
        completedCount,
        failedCount,
        totalCount: queueContacts.length,
        cursorContactId: activeEntry?.contactId || nextPending?.contactId || null,
        lastCompletedContactId: [...queueContacts].reverse().find((entry) => entry.status === "completed")?.contactId || null,
    };
}
function deriveBackfillJobStatus(queueContacts = [], fallbackStatus = "pending") {
    if (queueContacts.length === 0)
        return fallbackStatus;
    if (queueContacts.some((entry) => entry.status === "running"))
        return "running";
    if (queueContacts.every((entry) => ["completed", "failed"].includes(entry.status)))
        return "completed";
    return fallbackStatus;
}
function updateBackfillQueueContact(job, contactId, updater) {
    const nextQueue = (job.queueContacts || []).map((entry) => (entry.contactId === contactId ? updater(entry) : entry));
    const nextStatus = deriveBackfillJobStatus(nextQueue, job.status || "pending");
    return {
        ...job,
        queueContacts: nextQueue,
        status: nextStatus,
        checkpoint: recalculateBackfillCheckpoint(nextQueue),
    };
}
function createWhatsappInstanceRecord(payload = {}, ownershipContext = {}) {
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
function createWhatsappWebhookEventRecord(payload = {}, ownershipContext = {}) {
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
function createHistoryBackfillJobRecord(payload = {}, ownershipContext = {}) {
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
function getNextBackfillQueueContact(job = {}) {
    return (job.queueContacts || []).find((entry) => entry.status === "pending") || null;
}
function markBackfillContactAttempt(job = {}, contactId, metadata = {}) {
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
function markBackfillContactCompleted(job = {}, contactId, metadata = {}) {
    return updateBackfillQueueContact(job, contactId, (entry) => ({
        ...entry,
        status: "completed",
        completedAt: normalizeIsoString(metadata.completedAt) || entry.completedAt || null,
        digestId: metadata.digestId || entry.digestId || null,
        errorCode: null,
        errorMessage: null,
    }));
}
function markBackfillContactFailed(job = {}, contactId, metadata = {}) {
    return updateBackfillQueueContact(job, contactId, (entry) => ({
        ...entry,
        status: "failed",
        failedAt: normalizeIsoString(metadata.failedAt) || entry.failedAt || null,
        errorCode: metadata.errorCode || entry.errorCode || null,
        errorMessage: metadata.errorMessage || entry.errorMessage || null,
    }));
}
function createTxtImportJobRecord(payload = {}, ownershipContext = {}) {
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
function createMessageDispatchJobRecord(payload = {}, ownershipContext = {}) {
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
function normalizeWhatsappMessage(payload) {
    if (!payload || payload.event !== "messages.upsert")
        return null;
    const data = payload.data;
    const message = data.message;
    if (!message)
        return null;
    const text = message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        "";
    if (!text && !message.imageMessage)
        return null;
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
function createWhatsappExtractedTransactionRecord(payload = {}, ownershipContext = {}) {
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
//# sourceMappingURL=whatsappDomain.js.map