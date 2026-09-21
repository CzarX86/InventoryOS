import {
  applyOwnershipContext,
  buildDefaultAccountId,
  buildOwnershipContext,
  hasOwnershipBoundary,
} from "./ownership";

describe("ownership helpers", () => {
  it("builds a deterministic default account id from owner id", () => {
    expect(buildDefaultAccountId("user-123")).toBe("acct_user-123");
    expect(buildDefaultAccountId(null)).toBeNull();
  });

  it("derives owner and default account from the authenticated user", () => {
    expect(buildOwnershipContext({
      uid: "user-123",
      email: "owner@example.com",
    })).toEqual({
      ownerId: "user-123",
      defaultAccountId: "acct_user-123",
    });
  });

  it("applies ownership boundaries without overwriting an explicit accountId", () => {
    const context = {
      ownerId: "user-123",
      defaultAccountId: "acct_user-123",
    };

    expect(applyOwnershipContext({ type: "crm_event" }, context)).toEqual({
      type: "crm_event",
      ownerId: "user-123",
      accountId: "acct_user-123",
    });

    expect(applyOwnershipContext({ type: "crm_event", accountId: "acct_custom" }, context)).toEqual({
      type: "crm_event",
      ownerId: "user-123",
      accountId: "acct_custom",
    });

    expect(hasOwnershipBoundary({ ownerId: "user-123", accountId: "acct_user-123" })).toBe(true);
    expect(hasOwnershipBoundary({ ownerId: "user-123" })).toBe(false);
  });
});

