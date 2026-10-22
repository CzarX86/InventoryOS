import { expect, test } from "@playwright/test";

// Requires E2E_AUTH_BYPASS=1 (approved local admin, no Google login).
test.describe("crm shell @authed", () => {
  test("renders the contacts workspace with empty or populated lists", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "CRM", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "Contatos e relacionamento" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sua carteira" })).toBeVisible();
    await expect(
      page.getByPlaceholder("Buscar contato ou empresa")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo contato" })).toBeVisible();

    await expect(
      page.getByText(/carteira está vazia|\d+ contatos?/i).first()
    ).toBeVisible();
  });
});
