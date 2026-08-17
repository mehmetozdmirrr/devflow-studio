import { test, expect } from "@playwright/test";
import { createProject } from "./helpers";

/**
 * AC-008 (multi + custom domain selection retained with source), AC-009 (conditional questions
 * appear/disappear without silently deleting confirmed data). Navigates between wizard steps via
 * the step rail (client-side route change) rather than `page.goto`, since a full page load would
 * reload before the 800ms debounced autosave (`AUTOSAVE_DEBOUNCE_MS`) flushes an in-memory-only
 * change to storage.
 */
test.describe("wizard domain selection", () => {
  test("selects system + custom domains and shows/hides conditional prompts without deleting other data", async ({
    page,
  }) => {
    const id = await createProject(page, `Domains Project ${Date.now()}`);

    await page.goto(`/projects/${id}/wizard/domains`);
    await page.getByRole("checkbox", { name: "Mobile" }).check();
    await page.getByRole("checkbox", { name: "Backend and API" }).check();

    await page.getByLabel("Custom domain name").fill("3D Printing Software");
    await page.getByRole("button", { name: "Add domain" }).click();
    await expect(page.getByText("3D Printing Software")).toBeVisible();
    await expect(page.getByText("Select at least one domain")).not.toBeVisible();

    await page.getByRole("button", { name: "Data, integrations, and constraints" }).click();
    await page.getByLabel("Target users").fill("Solo developers");
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Consider app-store distribution for your mobile domain."),
    ).toBeVisible();
    await expect(
      page.getByText("Consider the expected request scale for your backend/API domain."),
    ).toBeVisible();

    // Remove the mobile domain — only mobile-dependent prompts should disappear; the backend prompt and the target-users tag must remain.
    await page.getByRole("button", { name: "Domains" }).click();
    // Unchecking a selected system domain opens a confirm dialog rather than toggling immediately
    // (AC-009), so the checkbox's own `checked` state does not flip on this click — use `.click()`
    // instead of `.uncheck()`, which would otherwise fail expecting an immediate state change.
    await page.getByRole("checkbox", { name: "Mobile" }).click();
    await expect(page.getByRole("heading", { name: /Remove "Mobile"/ })).toBeVisible();
    await page.getByRole("button", { name: "Remove domain" }).click();

    await page.getByRole("button", { name: "Data, integrations, and constraints" }).click();
    await expect(
      page.getByText("Consider app-store distribution for your mobile domain."),
    ).not.toBeVisible();
    await expect(
      page.getByText("Consider the expected request scale for your backend/API domain."),
    ).toBeVisible();
    await expect(page.getByText("Solo developers")).toBeVisible();
  });
});
