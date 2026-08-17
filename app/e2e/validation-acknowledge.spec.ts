import { test, expect } from "@playwright/test";
import { createProject } from "./helpers";

/** AC-018: acknowledging a warning/info issue is recorded, but a blocker still prevents export; an empty override reason is rejected. */
test.describe("validation acknowledge and export block", () => {
  test("acknowledges an info issue while a hard-conflict blocker still prevents export", async ({
    page,
  }) => {
    const id = await createProject(page, `Validation Project ${Date.now()}`);
    await page.goto(`/projects/${id}/wizard/recommendations`);

    // Jest + Vitest is a real, hard ("error"-severity) conflicts-with pair in the system catalog -> blocker.
    await page.getByLabel("Search by name").fill("Jest");
    await page.getByRole("button", { name: "Add" }).first().click();
    await page.getByLabel("Search by name").fill("Vitest");
    await page.getByRole("button", { name: "Add" }).first().click();

    await expect(
      page.getByText("One or more issues currently block package export."),
    ).toBeVisible();

    // A real deprecated system catalog item produces a "warning"-severity, acknowledgeable issue
    // (a synthetic custom item has no catalog identity to validate against, so it produces none).
    await page.getByLabel("Search by name").fill("Post-Commit Notify Hook");
    await page.getByRole("button", { name: "Add" }).first().click();

    const acknowledgeButton = page.getByRole("button", { name: "Acknowledge" }).first();
    await expect(acknowledgeButton).toBeDisabled();

    const reasonInput = page.getByPlaceholder("Reason for acknowledging").first();
    await reasonInput.fill("Reviewed and accepted for this project.");
    await expect(acknowledgeButton).toBeEnabled();
    await acknowledgeButton.click();
    await expect(page.getByText(/Acknowledged: Reviewed and accepted/)).toBeVisible();

    // The blocker is not resolvable by acknowledging — the Recommendations step's own validation
    // summary must still report export as blocked (`validation.canExport`, FR-029/AC-018).
    // Package Preview's own blocker gate (path-safety/secret-pattern checks, FR-039/040) is an
    // intentionally separate concern from this catalog-conflict gate — not asserted here.
    await expect(
      page.getByText("One or more issues currently block package export."),
    ).toBeVisible();
  });
});
