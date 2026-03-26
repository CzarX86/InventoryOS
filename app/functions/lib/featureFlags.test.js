"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const featureFlags_1 = require("./featureFlags");
describe("functions featureFlags helpers", () => {
    it("normalizes the Firestore payload into the expansion-track shape", () => {
        expect((0, featureFlags_1.normalizeFeatureFlags)({
            contactReviewQueue: "true",
            supplierRfq: 1,
            txtImport: "off",
        })).toEqual({
            ...featureFlags_1.DEFAULT_FEATURE_FLAGS,
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
        await expect((0, featureFlags_1.loadFeatureFlags)(db)).resolves.toEqual({
            ...featureFlags_1.DEFAULT_FEATURE_FLAGS,
            actionInbox: true,
            semiAutonomousAi: true,
        });
        expect(collection).toHaveBeenCalledWith("system");
        expect(doc).toHaveBeenCalledWith("feature_flags");
    });
    it("guards unknown flags", () => {
        expect((0, featureFlags_1.isFeatureEnabled)({ actionInbox: true }, "actionInbox")).toBe(true);
        expect((0, featureFlags_1.isFeatureEnabled)({ actionInbox: true }, "unknown")).toBe(false);
    });
});
//# sourceMappingURL=featureFlags.test.js.map