import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createProject } from "./helpers";

/** AC-005: export/import round-trip, and a malformed import changes no existing data. */
test.describe("backup export/import", () => {
  test("exports a backup and re-imports it without duplicating or losing the project", async ({
    page,
  }) => {
    const name = `Backup Project ${Date.now()}`;
    await createProject(page, name);
    await page.goto("/projects");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export backup" }).click(),
    ]);
    const filePath = await download.path();
    if (!filePath) throw new Error("Export backup did not produce a downloadable file");

    await page.getByRole("button", { name: "Import backup" }).click();
    await page.getByLabel("Backup file").setInputFiles(filePath);

    await expect(page.getByRole("heading", { name: "Import backup" })).toBeVisible();
    await expect(page.getByText(/0 new project\(s\) will be added\./)).toBeVisible();
    await expect(page.getByText(/1 project\(s\) already exist locally/)).toBeVisible();

    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(1);
  });

  test("a malformed backup file is rejected and changes no existing data", async ({ page }) => {
    const name = `Untouched Project ${Date.now()}`;
    await createProject(page, name);
    await page.goto("/projects");

    const malformedPath = path.join(
      await fs.mkdtemp(path.join(os.tmpdir(), "devflow-e2e-")),
      "bad.json",
    );
    await fs.writeFile(malformedPath, "{ this is not valid JSON", "utf-8");

    await page.getByRole("button", { name: "Import backup" }).click();
    await page.getByLabel("Backup file").setInputFiles(malformedPath);

    await expect(page.getByText("This file isn't valid JSON.")).toBeVisible();
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  });
});
