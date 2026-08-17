import { test, expect } from "@playwright/test";
import { createProject } from "./helpers";

/** AC-016: user removes a suggested/added item and manually adds another; regeneration (re-visiting the step) does not silently restore the removed choice. */
test.describe("recommendations accept/remove/manual-add", () => {
  test("manually adds an item, removes it, and confirms it stays removed after revisiting the step", async ({
    page,
  }) => {
    const id = await createProject(page, `Recs Project ${Date.now()}`);

    await page.goto(`/projects/${id}/wizard/recommendations`);
    await page.getByLabel("Search by name").fill("React");
    await page.getByRole("button", { name: "Add" }).first().click();

    await expect(page.getByRole("button", { name: "Remove" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Remove" }).first().click();
    await expect(page.getByRole("button", { name: "Restore" }).first()).toBeVisible();

    // Re-visit the step (simulates regeneration) — the removed item must not silently reappear as accepted.
    await page.goto(`/projects/${id}/wizard/profile`);
    await page.goto(`/projects/${id}/wizard/recommendations`);
    await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  });
});
