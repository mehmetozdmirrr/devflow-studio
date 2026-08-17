import { test, expect } from "@playwright/test";

/** AC-011 (filter, verified/user source visible), AC-014 (compare 2-4 items, 5th rejected with a clear limit message). */
test.describe("catalog filter and comparison", () => {
  test("filters by kind and shows the verified-source badge", async ({ page }) => {
    await page.goto("/catalog");
    await page.getByLabel("Kind").selectOption({ label: "Framework" });
    const cards = page.locator("ul li");
    await expect(cards.first()).toBeVisible();
    await expect(cards.first().getByText("Framework", { exact: true })).toBeVisible();
    await expect(cards.first().getByText("System verified")).toBeVisible();
  });

  test("comparing 4 items works; a 5th is rejected with a clear limit message", async ({
    page,
  }) => {
    await page.goto("/catalog");

    for (let i = 0; i < 4; i += 1) {
      await page.getByRole("button", { name: "Add to compare" }).first().click();
    }
    await expect(page.getByRole("button", { name: /Compare \(4\)/ })).toBeVisible();

    await page.getByRole("button", { name: "Add to compare" }).first().click();
    await expect(
      page.getByText("You can compare up to 4 items at a time. Remove one before adding another."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Compare \(4\)/ })).toBeVisible();

    await page.getByRole("button", { name: /Compare \(4\)/ }).click();
    await expect(page).toHaveURL(/\/compare$/);
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("columnheader")).toHaveCount(5);
  });
});
