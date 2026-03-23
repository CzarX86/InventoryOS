export const EXPANSION_FEATURE_FLAGS = [
  "contactReviewQueue",
  "whatsappIngestion",
  "actionInbox",
  "hardwareIntelligence",
  "txtImport",
  "supplierRfq",
  "semiAutonomousAi",
];

export const DEFAULT_FEATURE_FLAGS = Object.freeze({
  contactReviewQueue: false,
  whatsappIngestion: false,
  actionInbox: false,
  hardwareIntelligence: false,
  txtImport: false,
  supplierRfq: false,
  semiAutonomousAi: false,
});

function normalizeFlagValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on", "enabled"].includes(normalized);
  }

  return false;
}

export function normalizeFeatureFlags(rawFlags = {}) {
  return EXPANSION_FEATURE_FLAGS.reduce((acc, flag) => {
    acc[flag] = normalizeFlagValue(rawFlags?.[flag]);
    return acc;
  }, { ...DEFAULT_FEATURE_FLAGS });
}

export function mergeFeatureFlags(...flagSets) {
  return flagSets.reduce((acc, flagSet) => {
    const next = { ...acc };

    EXPANSION_FEATURE_FLAGS.forEach((flag) => {
      if (Object.prototype.hasOwnProperty.call(flagSet || {}, flag)) {
        next[flag] = normalizeFlagValue(flagSet?.[flag]);
      }
    });

    return next;
  }, { ...DEFAULT_FEATURE_FLAGS });
}

export function countEnabledFeatureFlags(flags = {}) {
  return EXPANSION_FEATURE_FLAGS.filter((flag) => Boolean(flags?.[flag])).length;
}

export function isFeatureEnabled(flags = {}, flag) {
  if (!EXPANSION_FEATURE_FLAGS.includes(flag)) return false;
  return Boolean(flags?.[flag]);
}
