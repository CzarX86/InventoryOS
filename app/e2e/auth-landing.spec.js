import { expect, test } from "@playwright/test";

test.describe("public landing", () => {
  test("shows the unauthenticated login experience", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Inventory\s+OS/i })).toBeVisible();
    await expect(page.getByText("Gestão de estoque com extração inteligente por IA.")).toBeVisible();

    const googleLoginButton = page.getByRole("button", { name: "Entrar com Google" });
    await expect(googleLoginButton).toBeVisible();
    await expect(googleLoginButton).toBeEnabled();
  });
});
