import { expect, test } from "@playwright/test";

// Deploy-readiness: static PWA/install artifacts every environment must serve.
// No authentication required; safe to run against staging pre-prod.
test.describe("deploy readiness @smoke", () => {
  test("serves a valid web manifest with reachable icons", async ({ request }) => {
    const manifestResponse = await request.get("/manifest.json");
    expect(manifestResponse.ok()).toBeTruthy();

    const manifest = await manifestResponse.json();
    expect(manifest.start_url).toBeTruthy();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);

    for (const icon of manifest.icons.slice(0, 4)) {
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.ok(), `icon ${icon.src} should resolve`).toBeTruthy();
    }
  });

  test("serves the offline fallback and the service worker", async ({ request }) => {
    const offlineResponse = await request.get("/offline.html");
    expect(offlineResponse.ok()).toBeTruthy();

    const swResponse = await request.get("/sw.js");
    expect(swResponse.ok()).toBeTruthy();
  });
});
