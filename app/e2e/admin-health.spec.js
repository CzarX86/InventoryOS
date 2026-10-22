import { expect, test } from "@playwright/test";

// Requires E2E_AUTH_BYPASS=1 (approved local admin, no Google login).
test.describe("admin health @authed", () => {
  test("shows measured health instead of hardcoded values", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Admin", exact: true }).click();

    await expect(page.getByText("Uso de IA e custos")).toBeVisible();
    await expect(page.getByText("14ms", { exact: true })).toHaveCount(0);
  });
});
