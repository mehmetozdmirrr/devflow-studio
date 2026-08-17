import { test, expect, type Page } from "@playwright/test";
import { createProject } from "./helpers";

/** Scopes to the single `<li>` whose card link is exactly `name` (avoids matching a "{name} (copy)" clone as a substring). */
function projectCard(page: Page, name: string) {
  return page.locator("li").filter({ has: page.getByRole("link", { name, exact: true }) });
}

/** AC-001 (create), AC-004 (trash/restore + permanent delete requires a second explicit confirmation). */
test.describe("project lifecycle", () => {
  test("create, clone, archive/unarchive, trash+undo, restore, and permanently delete a project", async ({
    page,
  }) => {
    const name = `Lifecycle Project ${Date.now()}`;
    await createProject(page, name);

    await page.goto("/projects");
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();

    // Clone — a new, independently named card appears; the original is untouched.
    await projectCard(page, name).getByRole("button", { name: "Clone" }).click();
    await expect(page.getByRole("link", { name: `${name} (copy)`, exact: true })).toBeVisible();

    const card = projectCard(page, name);

    // Archive then unarchive, each behind an explicit confirmation dialog.
    await card.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archive" }).click();
    await expect(card.getByRole("button", { name: "Unarchive" })).toBeVisible();

    await card.getByRole("button", { name: "Unarchive" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Unarchive" }).click();
    await expect(card.getByRole("button", { name: "Archive" })).toBeVisible();

    // Trash with confirm, then undo immediately via the toast.
    await card.getByRole("button", { name: "Move to trash" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Move to trash" }).click();
    await expect(page.getByRole("link", { name, exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();

    // Trash again, this time restore from the Trash page.
    await card.getByRole("button", { name: "Move to trash" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Move to trash" }).click();
    await page.goto("/trash");
    const trashRow = page.locator("li").filter({ hasText: name }).filter({ hasNotText: "copy" });
    await expect(trashRow).toBeVisible();
    await trashRow.getByRole("button", { name: "Restore" }).click();
    await page.goto("/projects");
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();

    // Trash a third time, then permanently delete — typing the exact name is a required second confirmation.
    await card.getByRole("button", { name: "Move to trash" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Move to trash" }).click();
    await page.goto("/trash");
    const trashRowAgain = page
      .locator("li")
      .filter({ hasText: name })
      .filter({ hasNotText: "copy" });
    await trashRowAgain.getByRole("button", { name: "Delete permanently" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Delete permanently" }).click();
    await expect(dialog.getByText("Doesn't match yet.")).toBeVisible();
    await dialog.getByLabel(new RegExp(`Type "${name}" to confirm`)).fill(name);
    await dialog.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page.getByText(name, { exact: true })).not.toBeVisible();
  });
});
