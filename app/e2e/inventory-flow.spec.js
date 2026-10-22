import { expect, test } from "@playwright/test";

// Requires E2E_AUTH_BYPASS=1 (approved local admin, no Google login).
test.describe("inventory flow @authed", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Inventário" })).toBeVisible();
  });

  test("navigates workspaces and validates the add-item form", async ({ page }) => {
    for (const tab of ["Início", "Inventário", "CRM", "Admin"]) {
      await expect(page.getByRole("button", { name: tab, exact: true })).toBeVisible();
    }

    await page.getByRole("button", { name: "Inventário", exact: true }).click();
    await expect(page.getByPlaceholder(/Buscar/)).toBeVisible();

    await page.getByRole("button", { name: "Novo item" }).click();
    await expect(page.getByText("SISTEMA_INGESTÃO_FORGE")).toBeVisible();

    await page.getByRole("button", { name: "INIT_DATA_COMMIT" }).click();
    await expect(
      page.getByText("O campo 'Tipo de Equipamento' é obrigatório.")
    ).toBeVisible();

    await page.getByRole("button", { name: "ABORT_SESSION" }).click();
    await expect(page.getByText("SISTEMA_INGESTÃO_FORGE")).toBeHidden();
  });
});
