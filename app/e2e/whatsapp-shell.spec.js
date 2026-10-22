import { expect, test } from "@playwright/test";

// Requires E2E_AUTH_BYPASS=1 (approved local admin, no Google login).
test.describe("whatsapp shell @authed", () => {
  test("renders the WhatsApp integration surface", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "WhatsApp", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: /WhatsApp conectado/ })
    ).toBeVisible();
    await expect(
      page.getByText(/Solicitar liberação|Solicitação em análise|Abrir configuração/).first()
    ).toBeVisible();
  });
});
