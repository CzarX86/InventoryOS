"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ownership_1 = require("./ownership");
describe("functions ownership helpers", () => {
    it("derives the default account from the owner", () => {
        expect((0, ownership_1.buildDefaultAccountId)("user-123")).toBe("acct_user-123");
    });
    it("applies boundaries consistently", () => {
        const context = (0, ownership_1.buildOwnershipContext)({ uid: "user-123" });
        expect(context).toEqual({
            ownerId: "user-123",
            defaultAccountId: "acct_user-123",
        });
        expect((0, ownership_1.applyOwnershipContext)({ kind: "message" }, context)).toEqual({
            kind: "message",
            ownerId: "user-123",
            accountId: "acct_user-123",
        });
        expect((0, ownership_1.hasOwnershipBoundary)({ ownerId: "user-123", accountId: "acct_user-123" })).toBe(true);
    });
});
//# sourceMappingURL=ownership.test.js.map