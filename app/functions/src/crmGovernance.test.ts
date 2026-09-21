import { buildRestoredContactPatch, buildSoftDeletedContactPatch } from "./crmGovernance";

describe("CRM governance policy", () => {
  it("soft-deletes instead of removing the original contact", () => {
    expect(buildSoftDeletedContactPatch("admin-1")).toMatchObject({
      status: "deleted",
      deletedBy: "admin-1",
    });
  });

  it("restores the previous status and clears deletion metadata", () => {
    expect(buildRestoredContactPatch("active", "admin-1")).toMatchObject({
      status: "active",
      restoredBy: "admin-1",
    });
  });
});
