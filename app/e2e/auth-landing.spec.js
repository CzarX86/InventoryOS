import { expect, test } from "@playwright/test";

test.describe("public landing @smoke", () => {
  test("shows the unauthenticated login experience", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "InventoryOS", exact: true })).toBeVisible();
    await expect(
      page.getByText("Inventário, relacionamento e operação em um só lugar.")
    ).toBeVisible();

    const googleLoginButton = page.getByRole("button", { name: "Entrar com Google" });
    await expect(googleLoginButton).toBeVisible();
    await expect(googleLoginButton).toBeEnabled();
  });
});
