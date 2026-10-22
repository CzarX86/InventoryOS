import { formatAppVersion } from "@/lib/appVersion";

describe("formatAppVersion", () => {
  it("formats a build version as short tag plus short sha", () => {
    expect(formatAppVersion("0.1.0+460e138504f5")).toBe("v0.1.0 (460e138)");
  });

  it("shows a plain version without build metadata as-is", () => {
    expect(formatAppVersion("0.1.0")).toBe("v0.1.0");
  });

  it("labels local builds without a version as dev", () => {
    expect(formatAppVersion(undefined)).toBe("dev");
    expect(formatAppVersion("")).toBe("dev");
  });
});
