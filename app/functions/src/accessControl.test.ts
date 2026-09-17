import { isConfiguredAdmin, isConfiguredOwner } from "./accessControl";

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

describe("configured admin resolution", () => {
  it("recognizes only a verified Google identity matching the configured admin email", () => {
    expect(isConfiguredAdmin({
      uid: "admin-1",
      token: { email: "MarcosBergaminJr@Example.com", email_verified: true },
    }, "marcosbergaminjr@example.com")).toBe(true);

    expect(isConfiguredAdmin({
      uid: "admin-1",
      token: { email: "marcosbergaminjr@example.com", email_verified: false },
    }, "marcosbergaminjr@example.com")).toBe(false);

    expect(isConfiguredAdmin({
      uid: "other-1",
      token: { email: "other@example.com", email_verified: true },
    }, "marcosbergaminjr@example.com")).toBe(false);
  });
});
