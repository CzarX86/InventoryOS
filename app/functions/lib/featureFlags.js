"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FEATURE_FLAGS = exports.EXPANSION_FEATURE_FLAGS = void 0;
exports.normalizeFeatureFlags = normalizeFeatureFlags;
exports.isFeatureEnabled = isFeatureEnabled;
exports.loadFeatureFlags = loadFeatureFlags;
exports.EXPANSION_FEATURE_FLAGS = [
    "contactReviewQueue",
    "whatsappIngestion",
    "actionInbox",
    "hardwareIntelligence",
    "txtImport",
    "supplierRfq",
    "semiAutonomousAi",
];
exports.DEFAULT_FEATURE_FLAGS = Object.freeze({
    contactReviewQueue: false,
    whatsappIngestion: false,
    actionInbox: false,
    hardwareIntelligence: false,
    txtImport: false,
    supplierRfq: false,
    semiAutonomousAi: false,
});
function normalizeFlagValue(value) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "number")
        return value > 0;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return ["1", "true", "yes", "on", "enabled"].includes(normalized);
    }
    return false;
}
function normalizeFeatureFlags(rawFlags = {}) {
    return exports.EXPANSION_FEATURE_FLAGS.reduce((acc, flag) => {
        acc[flag] = normalizeFlagValue(rawFlags?.[flag]);
        return acc;
    }, { ...exports.DEFAULT_FEATURE_FLAGS });
}
function isFeatureEnabled(flags = {}, flag) {
    if (!exports.EXPANSION_FEATURE_FLAGS.includes(flag))
        return false;
    return Boolean(flags?.[flag]);
}
async function loadFeatureFlags(db) {
    const snapshot = await db.collection("system").doc("feature_flags").get();
    return normalizeFeatureFlags(snapshot.exists ? snapshot.data() : {});
}
//# sourceMappingURL=featureFlags.js.map