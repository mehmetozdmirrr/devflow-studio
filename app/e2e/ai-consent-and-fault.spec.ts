import { test, expect } from "@playwright/test";
import { createProject } from "./helpers";

/**
 * AC-019 (consent notice before request, Cancel sends nothing), AC-022/NFR-004/013 (AI failure
 * still leaves the app usable, with a recoverable state). No real Anthropic API key or live
 * provider call is used anywhere — this suite runs against `vite preview` with no Netlify
 * Function present, so a real "Send" reproduces the same typed error/fallback state already
 * manually confirmed (TEST_EVIDENCE.md RUN-012), not a live AI response.
 */
test.describe("AI analysis consent and fault handling", () => {
  test("AI analysis is unreachable while disabled in Settings", async ({ page }) => {
    const id = await createProject(page, `AI Disabled Project ${Date.now()}`);
    await page.goto(`/projects/${id}/ai`);
    await expect(page.getByText("AI analysis is turned off.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start AI analysis" })).not.toBeVisible();
  });

  test("Cancel sends zero network requests; Send reproduces the documented no-function fallback", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.getByLabel("Enable optional AI assistance").check();

    const name = `AI Enabled Project ${Date.now()}`;
    const id = await createProject(page, name);
    await page.goto(`/projects/${id}/ai`);

    await expect(page.getByText(/Sending this request shares your project idea/)).toBeVisible();
    await page.getByRole("button", { name: "Start AI analysis" }).click();
    await expect(page.getByText(/Sending this request shares your project idea/)).toBeVisible();

    let requestSeen = false;
    await page.route("**/.netlify/functions/analyze-project", (route) => {
      requestSeen = true;
      void route.continue();
    });

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "Start AI analysis" })).toBeVisible();
    expect(requestSeen).toBe(false);

    await page.getByRole("button", { name: "Start AI analysis" }).click();
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText("AI analysis returned an unreadable response.")).toBeVisible();
    await expect(page.getByText("Continue with deterministic recommendations.")).toBeVisible();
    expect(requestSeen).toBe(true);

    // The deterministic wizard remains fully usable after an AI failure.
    await page.goto(`/projects/${id}`);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue configuration" })).toBeVisible();
  });
});
