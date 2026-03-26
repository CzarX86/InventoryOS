import { applyOwnershipContext } from "@/lib/ownership";

export const SUPPLIER_COLLECTIONS = Object.freeze({
  supplierAccounts: "supplier_accounts",
  supplierContacts: "supplier_contacts",
  quoteRequests: "quote_requests",
  quoteResponses: "quote_responses",
  supplierPerformanceProfiles: "supplier_performance_profiles",
  procurementOpportunities: "procurement_opportunities",
});

export const QUOTE_REQUEST_STATUSES = Object.freeze([
  "pending",
  "sent",
  "received",
  "expired",
  "cancelled",
]);

export const QUOTE_RESPONSE_STATUSES = Object.freeze([
  "pending",
  "received",
  "analyzed",
  "accepted",
  "rejected",
]);

export const SUPPLIER_PERFORMANCE_LEVELS = Object.freeze([
  "unknown",
  "poor",
  "fair",
  "good",
  "excellent",
]);

function buildBaseRecord(type, payload = {}, ownershipContext = {}) {
  return {
    type,
    ...applyOwnershipContext(payload, ownershipContext),
  };
}

export function createSupplierAccountRecord(payload = {}, ownershipContext = {}) {
  return buildBaseRecord("supplier_account", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    name: payload.name || null,
    status: payload.status || "active",
    category: payload.category || null,
    website: payload.website || null,
    notes: payload.notes || null,
    metadata: payload.metadata || {},
  }, ownershipContext);
}

export function createSupplierContactRecord(payload = {}, ownershipContext = {}) {
  return buildBaseRecord("supplier_contact", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    supplierId: payload.supplierId || null,
    name: payload.name || null,
    displayName: payload.displayName || payload.name || null,
    role: payload.role || null,
    status: payload.status || "active",
    phoneNumber: payload.phoneNumber || null,
    email: payload.email || null,
    notes: payload.notes || null,
    metadata: payload.metadata || {},
  }, ownershipContext);
}

export function createQuoteRequestRecord(payload = {}, ownershipContext = {}) {
  return buildBaseRecord("quote_request", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    supplierId: payload.supplierId || null,
    supplierContactId: payload.supplierContactId || null,
    catalogItemId: payload.catalogItemId || null,
    quantity: payload.quantity || 1,
    status: payload.status || "pending",
    requiredByAt: payload.requiredByAt || null,
    notes: payload.notes || null,
    metadata: payload.metadata || {},
    sourceProcurementOpportunityId: payload.sourceProcurementOpportunityId || null,
  }, ownershipContext);
}

export function createQuoteResponseRecord(payload = {}, ownershipContext = {}) {
  return buildBaseRecord("quote_response", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    quoteRequestId: payload.quoteRequestId || null,
    supplierId: payload.supplierId || null,
    status: payload.status || "received",
    price: payload.price || null,
    currency: payload.currency || "BRL",
    deliveryDays: payload.deliveryDays || null,
    validUntilAt: payload.validUntilAt || null,
    notes: payload.notes || null,
    metadata: payload.metadata || {},
  }, ownershipContext);
}

export function createSupplierPerformanceProfileRecord(payload = {}, ownershipContext = {}) {
  return buildBaseRecord("supplier_performance_profile", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    supplierId: payload.supplierId || null,
    overallLevel: payload.overallLevel || "unknown",
    reliabilityScore: payload.reliabilityScore ?? null,
    pricingScore: payload.pricingScore ?? null,
    deliveryScore: payload.deliveryScore ?? null,
    lastEvaluatedAt: payload.lastEvaluatedAt || null,
    metadata: payload.metadata || {},
  }, ownershipContext);
}

export function createProcurementOpportunityRecord(payload = {}, ownershipContext = {}) {
  return buildBaseRecord("procurement_opportunity", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    catalogItemId: payload.catalogItemId || null,
    title: payload.title || null,
    status: payload.status || "open",
    priority: payload.priority || "medium",
    estimatedTotalValue: payload.estimatedTotalValue || null,
    currency: payload.currency || "BRL",
    dueAt: payload.dueAt || null,
    metadata: payload.metadata || {},
  }, ownershipContext);
}
