import {
  applyOwnershipContext,
  buildDefaultAccountId,
  buildOwnershipContext,
  hasOwnershipBoundary,
} from "./ownership";

describe("functions ownership helpers", () => {
  it("derives the default account from the owner", () => {
    expect(buildDefaultAccountId("user-123")).toBe("acct_user-123");
  });

  it("applies boundaries consistently", () => {
    const context = buildOwnershipContext({ uid: "user-123" } as any);

    expect(context).toEqual({
      ownerId: "user-123",
      defaultAccountId: "acct_user-123",
    });

    expect(applyOwnershipContext({ kind: "message" }, context)).toEqual({
      kind: "message",
      ownerId: "user-123",
      accountId: "acct_user-123",
    });

    expect(hasOwnershipBoundary({ ownerId: "user-123", accountId: "acct_user-123" } as any)).toBe(true);
  });

  it("should PREVENT malicious override of ownerId if context is provided", () => {
    const maliciousPayload = { ownerId: "other-user", data: "secret" };
    const safeContext = { ownerId: "real-user", defaultAccountId: "acct_real-user" };
    
    const result = applyOwnershipContext(maliciousPayload, safeContext);
    
    // The context should ALWAYS override the payload ownerId
    expect(result.ownerId).toBe("real-user");
    expect(result.accountId).toBe("acct_real-user");
  });

  it("should handle null/empty context gracefully", () => {
    const payload = { data: "test" };
    const result = applyOwnershipContext(payload, null as any);
    expect(result.ownerId).toBeNull();
    expect(result.accountId).toBeNull();
  });
});
