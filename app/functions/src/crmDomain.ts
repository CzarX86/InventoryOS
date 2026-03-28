export const CRM_COLLECTIONS = Object.freeze({
  accounts: "accounts",
  contacts: "contacts",
  contactChannels: "contact_channels",
  conversations: "conversations",
  messages: "messages",
  opportunities: "opportunities",
  contracts: "contracts",
  crmEvents: "crm_events",
  tasks: "tasks",
  interests: "interests",
});

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

export function createAccountRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("account", {
    name: payload.name || null,
    kind: payload.kind || "customer",
    status: payload.status || "active",
    primaryContactId: payload.primaryContactId || null,
    segment: payload.segment || null,
    tags: payload.tags || [],
    notes: payload.notes || null,
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
  }, ownershipContext);
}

export function createContactRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("contact", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    name: payload.name || null,
    displayName: payload.displayName || payload.name || null,
    role: payload.role || null,
    status: payload.status || "active",
    phoneNumber: payload.phoneNumber || null,
    email: payload.email || null,
    source: payload.source || "manual",
    notes: payload.notes || null,
  }, ownershipContext);
}

export function createContactChannelRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("contact_channel", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    contactId: payload.contactId || null,
    channelType: payload.channelType || "whatsapp",
    channelValue: payload.channelValue || null,
    label: payload.label || null,
    isPrimary: Boolean(payload.isPrimary),
    status: payload.status || "active",
  }, ownershipContext);
}

export function createConversationRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("conversation", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    contactId: payload.contactId || null,
    channelType: payload.channelType || "whatsapp",
    channelId: payload.channelId || null,
    status: payload.status || "active",
    monitoringStatus: payload.monitoringStatus || "pending_review",
    lastMessageAt: payload.lastMessageAt || null,
    summary: payload.summary || null,
  }, ownershipContext);
}

export function createMessageRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("message", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    contactId: payload.contactId || null,
    conversationId: payload.conversationId || null,
    channelType: payload.channelType || "whatsapp",
    direction: payload.direction || "inbound",
    body: payload.body || null,
    occurredAt: payload.occurredAt || null,
    relevanceType: payload.relevanceType || "unknown",
    sourceMessageId: payload.sourceMessageId || null,
    sourceProvider: payload.sourceProvider || "internal",
  }, ownershipContext);
}

export function createOpportunityRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("opportunity", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    contactId: payload.contactId || null,
    title: payload.title || null,
    stage: payload.stage || "new",
    status: payload.status || "open",
    source: payload.source || "conversation",
    estimatedValue: payload.estimatedValue || null,
    currency: payload.currency || "BRL",
    nextActionAt: payload.nextActionAt || null,
  }, ownershipContext);
}

export function createContractRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("contract", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    contactId: payload.contactId || null,
    opportunityId: payload.opportunityId || null,
    status: payload.status || "active",
    startedAt: payload.startedAt || null,
    endedAt: payload.endedAt || null,
    referenceCode: payload.referenceCode || null,
    summary: payload.summary || null,
  }, ownershipContext);
}

export function createCrmEventRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("crm_event", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    contactId: payload.contactId || null,
    opportunityId: payload.opportunityId || null,
    contractId: payload.contractId || null,
    eventType: payload.eventType || "unknown",
    occurredAt: payload.occurredAt || null,
    confidence: payload.confidence ?? null,
    sourceMessageIds: payload.sourceMessageIds || [],
    summary: payload.summary || null,
  }, ownershipContext);
}

export function createTaskRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("task", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    contactId: payload.contactId || null,
    opportunityId: payload.opportunityId || null,
    contractId: payload.contractId || null,
    title: payload.title || null,
    taskType: payload.taskType || "follow_up",
    status: payload.status || "pending",
    dueAt: payload.dueAt || null,
    assignedToUserId: payload.assignedToUserId || ownershipContext?.ownerId || null,
  }, ownershipContext);
}

export function createInterestRecord(payload: any = {}, ownershipContext: any = {}) {
  return buildBaseRecord("interest", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    contactId: payload.contactId || null,
    opportunityId: payload.opportunityId || null,
    catalogItemId: payload.catalogItemId || null,
    interestType: payload.interestType || "hardware",
    confidence: payload.confidence ?? null,
    sourceMessageIds: payload.sourceMessageIds || [],
    summary: payload.summary || null,
  }, ownershipContext);
}
