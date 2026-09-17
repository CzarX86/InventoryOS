import { isConfiguredOwner } from "./accessControl";

describe("access owner resolution", () => {
  it("recognizes only a verified Google identity matching the configured owner email", () => {
    expect(isConfiguredOwner({
      uid: "owner-1",
      token: { email: "Owner@Example.com", email_verified: true },
    }, "owner@example.com")).toBe(true);

    expect(isConfiguredOwner({
      uid: "owner-1",
      token: { email: "owner@example.com", email_verified: false },
    }, "owner@example.com")).toBe(false);

    expect(isConfiguredOwner({
      uid: "other-1",
      token: { email: "other@example.com", email_verified: true },
    }, "owner@example.com")).toBe(false);
  });
});
