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

function normalizeFlagValue(value: any) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on", "enabled"].includes(normalized);
  }

  return false;
}

export function normalizeFeatureFlags(rawFlags: any = {}) {
  return EXPANSION_FEATURE_FLAGS.reduce((acc: any, flag) => {
    acc[flag] = normalizeFlagValue(rawFlags?.[flag]);
    return acc;
  }, { ...DEFAULT_FEATURE_FLAGS });
}

export function isFeatureEnabled(flags: any = {}, flag: string) {
  if (!EXPANSION_FEATURE_FLAGS.includes(flag)) return false;
  return Boolean(flags?.[flag]);
}

export async function loadFeatureFlags(db: any) {
  const snapshot = await db.collection("system").doc("feature_flags").get();
  return normalizeFeatureFlags(snapshot.exists ? snapshot.data() : {});
}
