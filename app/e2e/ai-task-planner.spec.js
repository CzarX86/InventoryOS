import { test, expect } from "@playwright/test";

test.describe("AI Task Planner E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Forge Referer to bypass Gemini API restrictions during local E2E
    await page.setExtraHTTPHeaders({
      'Referer': 'https://inventoryos-effd5.web.app/'
    });
  });

  test("should successfully plan and execute a demo AI extraction flow", async ({ page }) => {
    // 1. Navigate to the test bench (Assuming dev mode is running)
    await page.goto("/dev/ai-test");
    
    await expect(page.locator("h1")).toContainText("AI Infrastructure Test Bench");

    // 2. Login first
    const loginBtn = page.locator("#login-btn");
    await loginBtn.click();
    await expect(page.locator(".bg-zinc-900")).toContainText("Mock login successful (Bypassed Auth).", { timeout: 10000 });

    // 3. Click the run button
    const runBtn = page.locator("#run-demo-btn");
    await runBtn.click();

    // 3. Wait for the process to complete (can take a few seconds due to AI)
    // We increase timeout for this test
    await expect(page.locator("#test-finished")).toBeVisible({ timeout: 45000 });

    // 4. Verify completed logs in the console area
    const logArea = page.locator(".bg-zinc-900");
    await expect(logArea).toContainText("Execution COMPLETED!");
    await expect(logArea).toContainText("Actual Total Tokens:");
    await expect(logArea).toContainText("Domain Record with LINEAGE:");
  });
});
