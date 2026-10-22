import { expect, test } from "@playwright/test";

// Requires E2E_AUTH_BYPASS=1 (approved local admin, no Google login).
test.describe("action inbox @authed", () => {
  test("renders the opportunities and tasks queues without crashing", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Central de ações|Ações/ }).click();

    await expect(
      page.getByRole("heading", { name: "Central de ações" })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /Oportunidades/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Tarefas/ })).toBeVisible();
  });
});
