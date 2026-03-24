import {
  DEFAULT_FEATURE_FLAGS,
  EXPANSION_FEATURE_FLAGS,
  countEnabledFeatureFlags,
  isFeatureEnabled,
  mergeFeatureFlags,
  normalizeFeatureFlags,
} from "./featureFlags";

describe("featureFlags helpers", () => {
  it("normalizes booleans from mixed raw values", () => {
    const normalized = normalizeFeatureFlags({
      contactReviewQueue: true,
      whatsappIngestion: "true",
      actionInbox: "enabled",
      hardwareIntelligence: 1,
      txtImport: "no",
      supplierRfq: 0,
      semiAutonomousAi: "off",
      ignoredFlag: true,
    });

    expect(normalized).toEqual({
      contactReviewQueue: true,
      whatsappIngestion: true,
      actionInbox: true,
      hardwareIntelligence: true,
      txtImport: false,
      supplierRfq: false,
      semiAutonomousAi: false,
    });
  });

  it("merges flag sets onto the default expansion-track shape", () => {
    const merged = mergeFeatureFlags(
      { contactReviewQueue: true, txtImport: "true" },
      { supplierRfq: true }
    );

    expect(Object.keys(merged)).toEqual(EXPANSION_FEATURE_FLAGS);
    expect(merged.contactReviewQueue).toBe(true);
    expect(merged.txtImport).toBe(true);
    expect(merged.supplierRfq).toBe(true);
    expect(merged.actionInbox).toBe(false);
  });

  it("counts enabled flags and guards unknown names", () => {
    expect(countEnabledFeatureFlags(DEFAULT_FEATURE_FLAGS)).toBe(1);
    expect(countEnabledFeatureFlags({
      ...DEFAULT_FEATURE_FLAGS,
      contactReviewQueue: true,
      whatsappIngestion: true,
      supplierRfq: true,
    })).toBe(3);
    expect(isFeatureEnabled({ actionInbox: true }, "actionInbox")).toBe(true);
    expect(isFeatureEnabled({ actionInbox: true }, "unknownFlag")).toBe(false);
  });
});

