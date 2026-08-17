import { test, expect } from "@playwright/test";
import { createProject } from "./helpers";

/** AC-023 (tree/content render before download), AC-027 (ZIP/manifest/Markdown/single-file exports succeed). */
test.describe("package preview and export", () => {
  test("generates a preview, edits/excludes a file, and downloads every export format", async ({
    page,
  }) => {
    const id = await createProject(page, `Package Project ${Date.now()}`);
    await page.goto(`/projects/${id}/package`);

    await page.getByRole("button", { name: "Generate preview" }).click();
    await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();
    const fileItems = page.locator("li", { has: page.getByRole("button", { name: "Download" }) });
    await expect(fileItems.first()).toBeVisible();

    // Locators re-run their filter on every use, so "has an Exclude/Edit button" would stop
    // matching the instant that button's label flips (Exclude -> Include, Edit -> textarea).
    // Scope by the file's own path text instead, which is stable across both toggles.
    async function byPath(hasButtonName: string): Promise<ReturnType<typeof page.locator> | null> {
      const match = fileItems
        .filter({ has: page.getByRole("button", { name: hasButtonName }) })
        .first();
      if (!(await match.count())) return null;
      const path = await match.locator("span.font-mono").innerText();
      return fileItems.filter({ hasText: path });
    }

    // Exclude an optional file — excluded files are dropped from the regenerated tree entirely
    // (packageGenerator.ts filters them out of the build), so the row disappears rather than
    // flipping to an "Include" state.
    const excludable = await byPath("Exclude");
    if (excludable) {
      const path = await excludable.locator("span.font-mono").innerText();
      await excludable.getByRole("button", { name: "Exclude" }).click();
      await expect(fileItems.filter({ hasText: path })).toHaveCount(0);
    }

    // Edit an editable file's content, save the override, then reset it back to the template.
    const editable = await byPath("Edit");
    if (editable) {
      await editable.getByRole("button", { name: "Edit" }).click();
      const textarea = editable.locator("textarea");
      await textarea.fill((await textarea.inputValue()) + "\n<!-- e2e override -->");
      await editable.getByRole("button", { name: "Save" }).click();
      await expect(editable.getByRole("button", { name: "Reset to template" })).toBeVisible();
      await editable.getByRole("button", { name: "Reset to template" }).click();
    }

    await expect(page.getByRole("button", { name: "Download ZIP" })).toBeEnabled();

    const [zip] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download ZIP" }).click(),
    ]);
    expect(zip.suggestedFilename()).toMatch(/\.zip$/);

    const [manifest] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download manifest JSON" }).click(),
    ]);
    expect(manifest.suggestedFilename()).toMatch(/manifest\.json$/);

    const [markdown] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download Markdown bundle" }).click(),
    ]);
    expect(markdown.suggestedFilename()).toMatch(/\.md$/);

    const [singleFile] = await Promise.all([
      page.waitForEvent("download"),
      fileItems.first().getByRole("button", { name: "Download" }).click(),
    ]);
    expect(singleFile.suggestedFilename().length).toBeGreaterThan(0);
  });
});
