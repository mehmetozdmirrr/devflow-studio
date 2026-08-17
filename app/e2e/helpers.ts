import type { Page } from "@playwright/test";

/** Fills the Create Project form and submits it, landing on the wizard's profile step. Returns the project id parsed from the resulting URL. */
export async function createProject(page: Page, name: string): Promise<string> {
  await page.goto("/projects/new");
  await page.getByLabel("Project name").fill(name);
  await page.getByLabel("Idea").fill(`${name} idea`);
  await page.getByLabel("Problem").fill(`${name} problem`);
  await page.getByLabel("Proposed solution").fill(`${name} solution`);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/[^/]+\/wizard\/profile/);
  const match = /\/projects\/([^/]+)\/wizard/.exec(page.url());
  if (!match) throw new Error(`Could not parse project id from URL: ${page.url()}`);
  return match[1];
}
