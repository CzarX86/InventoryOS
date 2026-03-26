const {
  DEFAULT_FEATURE_FLAGS,
  isFeatureEnabled,
  loadFeatureFlags,
  normalizeFeatureFlags,
} = require("./featureFlags");

describe("functions featureFlags helpers", () => {
  it("normalizes the Firestore payload into the expansion-track shape", () => {
    expect(normalizeFeatureFlags({
      contactReviewQueue: "true",
      supplierRfq: 1,
      txtImport: "off",
    })).toEqual({
      ...DEFAULT_FEATURE_FLAGS,
      contactReviewQueue: true,
      supplierRfq: true,
      txtImport: false,
    });
  });

  it("loads and normalizes feature flags from Firestore", async () => {
    const get = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        actionInbox: true,
        semiAutonomousAi: "enabled",
      }),
    });
    const doc = jest.fn(() => ({ get }));
    const collection = jest.fn(() => ({ doc }));
    const db = { collection };

    await expect(loadFeatureFlags(db)).resolves.toEqual({
      ...DEFAULT_FEATURE_FLAGS,
      actionInbox: true,
      semiAutonomousAi: true,
    });

    expect(collection).toHaveBeenCalledWith("system");
    expect(doc).toHaveBeenCalledWith("feature_flags");
  });

  it("guards unknown flags", () => {
    expect(isFeatureEnabled({ actionInbox: true }, "actionInbox")).toBe(true);
    expect(isFeatureEnabled({ actionInbox: true }, "unknown")).toBe(false);
  });
});

