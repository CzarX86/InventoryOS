const {
  applyOwnershipContext,
  buildDefaultAccountId,
  buildOwnershipContext,
  hasOwnershipBoundary,
} = require("./ownership");

describe("functions ownership helpers", () => {
  it("derives the default account from the owner", () => {
    expect(buildDefaultAccountId("user-123")).toBe("acct_user-123");
  });

  it("applies boundaries consistently", () => {
    const context = buildOwnershipContext({ uid: "user-123" });

    expect(context).toEqual({
      ownerId: "user-123",
      defaultAccountId: "acct_user-123",
    });

    expect(applyOwnershipContext({ kind: "message" }, context)).toEqual({
      kind: "message",
      ownerId: "user-123",
      accountId: "acct_user-123",
    });

    expect(hasOwnershipBoundary({ ownerId: "user-123", accountId: "acct_user-123" })).toBe(true);
  });
});

