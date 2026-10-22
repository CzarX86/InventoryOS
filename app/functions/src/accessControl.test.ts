import { isConfiguredAdmin, isConfiguredOwner, isWorkspaceMember } from "./accessControl";

describe("workspace member read gate", () => {
  const workspaceId = "workspace_inventoryos";

  it("admits the owner without a member profile", () => {
    expect(isWorkspaceMember({ uid: "owner-1" }, workspaceId, "owner-1")).toBe(true);
  });

  it("admits approved members of the same workspace", () => {
    expect(isWorkspaceMember(
      { uid: "u-1", accessStatus: "approved", workspaceId },
      workspaceId,
      "owner-1",
    )).toBe(true);
    expect(isWorkspaceMember(
      { uid: "u-2", accessStatus: "approved", defaultAccountId: workspaceId },
      workspaceId,
      "owner-1",
    )).toBe(true);
  });

  it("denies pending, revoked, and other-workspace profiles", () => {
    expect(isWorkspaceMember(
      { uid: "u-3", accessStatus: "pending", workspaceId },
      workspaceId,
      "owner-1",
    )).toBe(false);
    expect(isWorkspaceMember(
      { uid: "u-4", accessStatus: "approved", workspaceId: "workspace_other" },
      workspaceId,
      "owner-1",
    )).toBe(false);
    expect(isWorkspaceMember(null, workspaceId, "owner-1")).toBe(false);
    expect(isWorkspaceMember({ uid: "u-5", accessStatus: "approved", workspaceId }, "", "owner-1")).toBe(false);
  });
});

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
