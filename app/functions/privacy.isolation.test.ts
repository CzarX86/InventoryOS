import { applyOwnershipContext, buildOwnershipContext } from "./ownership";

describe("Data Isolation & Privacy (Industrial Grade)", () => {
  const userA = buildOwnershipContext({ uid: "user-A" });
  const userB = buildOwnershipContext({ uid: "user-B" });

  it("should mark entities with distinct ownerIds and never allow cross-contamination", () => {
    const dataA = { type: "opportunity", title: "Deal A" };
    const dataB = { type: "opportunity", title: "Deal B" };

    const recordA = applyOwnershipContext(dataA, userA);
    const recordB = applyOwnershipContext(dataB, userB);

    expect(recordA.ownerId).toBe("user-A");
    expect(recordB.ownerId).toBe("user-B");
    expect(recordA.ownerId).not.toBe(recordB.ownerId);
  });

  it("should ensure accountId is strictly derived from the correct owner context", () => {
    const payload = { type: "transaction" };
    const record = applyOwnershipContext(payload, userA);
    
    expect(record.accountId).toBe("acct_user-A");
    expect(record.accountId).not.toBe("acct_user-B");
  });
});
