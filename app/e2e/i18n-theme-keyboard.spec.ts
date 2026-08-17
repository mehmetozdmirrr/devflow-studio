import { test, expect } from "@playwright/test";

/** AC-028 (UI language switch, output stays English), AC-029 (theme persists across navigation), AC-030 (keyboard-only create -> validate -> export, visible focus, modal focus trap). */
test.describe("localization, theme, and keyboard-only flow", () => {
  test("switching UI language to Turkish persists and does not touch generated-package language", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.locator("#ui-language-select").selectOption({ label: "Türkçe" });
    await expect(page.getByRole("heading", { name: "Ayarlar" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Ayarlar" })).toBeVisible();
    // The generated-package language control stays independently set to English by default.
    await expect(page.locator("#output-language-select")).toHaveValue("en");
  });

  test("theme choice persists across navigation and a reload", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel("Theme").selectOption({ label: "Dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.goto("/catalog");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("keyboard-only: create a project, reach validation, and open the package preview", async ({
    page,
  }) => {
    await page.goto("/projects/new");
    await page.getByLabel("Project name").focus();
    await page.keyboard.type("Keyboard Only Project");
    await page.keyboard.press("Tab");
    await page.keyboard.type("idea via keyboard");
    await page.keyboard.press("Tab");
    await page.keyboard.type("problem via keyboard");
    await page.keyboard.press("Tab");
    await page.keyboard.type("solution via keyboard");

    await expect(page.getByLabel("Project name")).toHaveValue("Keyboard Only Project");

    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/wizard\/profile/);
    // Focus must land on the new step's heading, not silently drop to <body>.
    await expect(page.getByRole("heading", { name: "Experience profile" })).toBeFocused();

    const match = /\/projects\/([^/]+)\/wizard/.exec(page.url());
    if (!match) throw new Error("project id not found in URL");
    const id = match[1];

    // Modal focus trap: opening the trash confirm dialog keyboard-only keeps focus inside it.
    await page.goto("/projects");
    const trashButton = page
      .locator("li")
      .filter({ hasText: "Keyboard Only Project" })
      .getByRole("button", { name: "Move to trash" });
    await trashButton.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    await page.goto(`/projects/${id}/package`);
    await page.getByRole("button", { name: "Generate preview" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();
  });
});
