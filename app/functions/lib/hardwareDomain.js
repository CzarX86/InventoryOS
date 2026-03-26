"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ITEM_RELATIONSHIP_TYPES = exports.INVENTORY_ITEM_STATUSES = exports.HARDWARE_COLLECTIONS = void 0;
exports.buildCatalogItemCanonicalKey = buildCatalogItemCanonicalKey;
exports.createCatalogItemRecord = createCatalogItemRecord;
exports.createInventoryItemRecord = createInventoryItemRecord;
exports.createInstalledBaseRecord = createInstalledBaseRecord;
exports.createMaintenanceRuleRecord = createMaintenanceRuleRecord;
exports.createItemRelationshipRecord = createItemRelationshipRecord;
exports.canRecommendItemRelationship = canRecommendItemRelationship;
function applyOwnershipContext(payload = {}, context = {}) {
    return {
        ...payload,
        ownerId: context?.ownerId || null,
        accountId: payload?.accountId || context?.defaultAccountId || null,
    };
}
exports.HARDWARE_COLLECTIONS = Object.freeze({
    catalogItems: "catalog_items",
    inventoryItems: "inventory_items",
    installedBase: "installed_base",
    maintenanceRules: "maintenance_rules",
    itemRelationships: "item_relationships",
});
exports.INVENTORY_ITEM_STATUSES = Object.freeze([
    "IN STOCK",
    "SOLD",
    "REPAIR",
    "RESERVED",
]);
exports.ITEM_RELATIONSHIP_TYPES = Object.freeze([
    "compatible",
    "substitute",
    "maintenance_related",
    "cross_sell",
    "upsell",
    "commonly_co_installed",
]);
function buildBaseRecord(type, payload = {}, ownershipContext = {}) {
    return {
        type,
        ...applyOwnershipContext(payload, ownershipContext),
    };
}
function normalizeString(value) {
    return String(value || "").trim();
}
function normalizeUpperToken(value) {
    return normalizeString(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .toUpperCase();
}
function normalizeCount(value, fallback = 0) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0)
        return fallback;
    return numericValue;
}
function normalizeConfidence(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue))
        return null;
    return Math.max(0, Math.min(1, Number(numericValue.toFixed(4))));
}
function buildCatalogItemCanonicalKey(payload = {}) {
    return [
        payload.type,
        payload.brand,
        payload.model,
        payload.partNumber,
    ].map(normalizeUpperToken).join("|");
}
function createCatalogItemRecord(payload = {}, ownershipContext = {}) {
    return buildBaseRecord("catalog_item", {
        accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
        itemType: normalizeString(payload.type) || null,
        legacyType: normalizeString(payload.type) || null,
        brand: normalizeString(payload.brand) || null,
        model: normalizeString(payload.model) || null,
        partNumber: normalizeString(payload.partNumber) || null,
        specifications: normalizeString(payload.specifications) || null,
        canonicalKey: payload.canonicalKey || buildCatalogItemCanonicalKey(payload),
        category: normalizeString(payload.category) || normalizeString(payload.type) || "Geral",
        quantityOnHand: normalizeCount(payload.quantityOnHand, 0),
        quantityReserved: normalizeCount(payload.quantityReserved, 0),
        quantityAvailable: payload.quantityAvailable != null
            ? normalizeCount(payload.quantityAvailable, 0)
            : Math.max(normalizeCount(payload.quantityOnHand, 0) - normalizeCount(payload.quantityReserved, 0), 0),
        status: payload.status || "active",
        isSellable: payload.isSellable ?? true,
        isServiceable: payload.isServiceable ?? true,
        isSupportedByBusiness: payload.isSupportedByBusiness ?? true,
        source: payload.source || "catalog",
        metadata: payload.metadata || {},
    }, ownershipContext);
}
function createInventoryItemRecord(payload = {}, ownershipContext = {}) {
    return buildBaseRecord("inventory_item", {
        accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
        catalogItemId: payload.catalogItemId || null,
        legacyInventoryItemId: payload.legacyInventoryItemId || null,
        itemType: normalizeString(payload.type) || null,
        legacyType: normalizeString(payload.type) || null,
        brand: normalizeString(payload.brand) || null,
        model: normalizeString(payload.model) || null,
        partNumber: normalizeString(payload.partNumber) || null,
        specifications: normalizeString(payload.specifications) || null,
        status: payload.status || "IN STOCK",
        quantity: normalizeCount(payload.quantity, 1),
        serialNumber: normalizeString(payload.serialNumber) || null,
        storageLocation: normalizeString(payload.storageLocation) || null,
        productImageUrl: payload.productImageUrl || null,
        audioUrl: payload.audioUrl || null,
        metadata: payload.metadata || {},
    }, ownershipContext);
}
function createInstalledBaseRecord(payload = {}, ownershipContext = {}) {
    return buildBaseRecord("installed_base_item", {
        accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
        crmAccountId: payload.crmAccountId || null,
        crmContactId: payload.crmContactId || null,
        catalogItemId: payload.catalogItemId || null,
        inventoryItemId: payload.inventoryItemId || null,
        quantity: normalizeCount(payload.quantity, 1),
        confidence: normalizeConfidence(payload.confidence),
        source: payload.source || "inferred",
        status: payload.status || "active",
        observedAt: payload.observedAt || null,
        metadata: payload.metadata || {},
    }, ownershipContext);
}
function createMaintenanceRuleRecord(payload = {}, ownershipContext = {}) {
    return buildBaseRecord("maintenance_rule", {
        accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
        catalogItemId: payload.catalogItemId || null,
        serviceType: payload.serviceType || "preventive_maintenance",
        recommendedIntervalDays: normalizeCount(payload.recommendedIntervalDays, 0),
        gracePeriodDays: normalizeCount(payload.gracePeriodDays, 0),
        allowedForRecommendation: payload.allowedForRecommendation ?? true,
        isSupportedByBusiness: payload.isSupportedByBusiness ?? true,
        notes: payload.notes || null,
        metadata: payload.metadata || {},
    }, ownershipContext);
}
function createItemRelationshipRecord(payload = {}, ownershipContext = {}) {
    return buildBaseRecord("item_relationship", {
        accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
        sourceCatalogItemId: payload.sourceCatalogItemId || null,
        relatedCatalogItemId: payload.relatedCatalogItemId || null,
        relationshipType: payload.relationshipType || "compatible",
        relationshipScope: payload.relationshipScope || "business_context",
        confidence: normalizeConfidence(payload.confidence),
        isSellable: payload.isSellable ?? true,
        isServiceable: payload.isServiceable ?? false,
        isSupportedByBusiness: payload.isSupportedByBusiness ?? true,
        allowedForRecommendation: payload.allowedForRecommendation ?? true,
        rationale: payload.rationale || null,
        metadata: payload.metadata || {},
    }, ownershipContext);
}
function canRecommendItemRelationship(relationship = {}) {
    if (!relationship?.allowedForRecommendation)
        return false;
    if (!relationship?.isSupportedByBusiness)
        return false;
    return Boolean(relationship?.isSellable || relationship?.isServiceable);
}
//# sourceMappingURL=hardwareDomain.js.map