import { describe, expect, it } from "vitest";

import { acknowledgeValidationIssue, runValidationEngine } from "../domain/validationEngine";
import { acceptCatalogSelection } from "../domain/selections";
import { SYSTEM_CATALOG_ITEMS } from "../catalog/systemCatalog";

const react = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "framework-react")!;
const nextjs = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "framework-nextjs")!;
const redux = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "state-management-redux")!;
const zustand = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "state-management-zustand")!;
const jest = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "testing-tool-jest")!;
const vitest = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "testing-tool-vitest")!;
const deprecatedHook = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "hook-post-commit-notify")!;

function baseArgs() {
  return {
    catalogItems: SYSTEM_CATALOG_ITEMS,
    targetPlatforms: [] as string[],
    validatorVersion: "test-1",
  };
}

describe("runValidationEngine — dependency detection (FR-028, AC-017)", () => {
  it("flags a missing hard dependency and blocks export", () => {
    const selections = acceptCatalogSelection([], "project-1", nextjs, "manual");
    const result = runValidationEngine({ ...baseArgs(), selections });
    const issue = result.issues.find((i) => i.code === "MISSING_DEPENDENCY");
    expect(issue).toBeDefined();
    expect(issue?.relatedIds).toContain("framework-react");
    expect(result.canExport).toBe(false);
  });

  it("does not flag the dependency once the required item is also accepted", () => {
    let selections = acceptCatalogSelection([], "project-1", nextjs, "manual");
    selections = acceptCatalogSelection(selections, "project-1", react, "manual");
    const result = runValidationEngine({ ...baseArgs(), selections });
    expect(result.issues.some((i) => i.code === "MISSING_DEPENDENCY")).toBe(false);
  });

  it("de-duplicates repeated validation runs into one issue per stable code+relatedIds", () => {
    const selections = acceptCatalogSelection([], "project-1", nextjs, "manual");
    const first = runValidationEngine({ ...baseArgs(), selections });
    const second = runValidationEngine({ ...baseArgs(), selections });
    expect(second.issues).toEqual(first.issues);
    expect(first.issues.filter((i) => i.code === "MISSING_DEPENDENCY")).toHaveLength(1);
  });
});

describe("runValidationEngine — soft conflict (warning)", () => {
  it("flags a soft conflict as a warning, not blocking export by itself", () => {
    let selections = acceptCatalogSelection([], "project-1", react, "manual");
    selections = acceptCatalogSelection(selections, "project-1", redux, "manual");
    selections = acceptCatalogSelection(selections, "project-1", zustand, "manual");
    const result = runValidationEngine({ ...baseArgs(), selections });
    const issue = result.issues.find((i) => i.code === "CONFLICTING_SELECTIONS");
    expect(issue?.severity).toBe("warning");
    expect(result.canExport).toBe(true);
  });
});

describe("runValidationEngine — hard conflict (FR-028, AC-017)", () => {
  it("flags a hard conflict as a blocker regardless of which side declared the relation", () => {
    let selections = acceptCatalogSelection([], "project-1", jest, "manual");
    selections = acceptCatalogSelection(selections, "project-1", vitest, "manual");
    const result = runValidationEngine({ ...baseArgs(), selections });
    const issue = result.issues.find((i) => i.code === "CONFLICTING_SELECTIONS");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("blocker");
    expect(result.canExport).toBe(false);
  });

  it("produces exactly one conflict issue, not one per direction", () => {
    let selections = acceptCatalogSelection([], "project-1", jest, "manual");
    selections = acceptCatalogSelection(selections, "project-1", vitest, "manual");
    const result = runValidationEngine({ ...baseArgs(), selections });
    expect(result.issues.filter((i) => i.code === "CONFLICTING_SELECTIONS")).toHaveLength(1);
  });
});

describe("runValidationEngine — deprecated content", () => {
  it("warns on a deprecated selection without blocking export by itself", () => {
    const selections = acceptCatalogSelection([], "project-1", deprecatedHook, "manual");
    const result = runValidationEngine({ ...baseArgs(), selections });
    const issue = result.issues.find((i) => i.code === "DEPRECATED_SELECTION");
    expect(issue?.severity).toBe("warning");
    expect(result.canExport).toBe(true);
  });
});

describe("acknowledgeValidationIssue (FR-029, AC-018)", () => {
  it("records an override on a warning with a non-empty reason", () => {
    const selections = acceptCatalogSelection([], "project-1", deprecatedHook, "manual");
    const validation = runValidationEngine({ ...baseArgs(), selections });
    const issue = validation.issues.find((i) => i.code === "DEPRECATED_SELECTION")!;
    const updated = acknowledgeValidationIssue(validation, issue.id, "Accepted for now", "user-1");
    const updatedIssue = updated.issues.find((i) => i.id === issue.id);
    expect(updatedIssue?.override?.reason).toBe("Accepted for now");
    expect(updated.canExport).toBe(true);
  });

  it("rejects an empty override reason", () => {
    const selections = acceptCatalogSelection([], "project-1", deprecatedHook, "manual");
    const validation = runValidationEngine({ ...baseArgs(), selections });
    const issue = validation.issues.find((i) => i.code === "DEPRECATED_SELECTION")!;
    const updated = acknowledgeValidationIssue(validation, issue.id, "   ", "user-1");
    expect(updated.issues.find((i) => i.id === issue.id)?.override).toBeUndefined();
  });

  it("never overrides a blocker — export stays blocked", () => {
    let selections = acceptCatalogSelection([], "project-1", jest, "manual");
    selections = acceptCatalogSelection(selections, "project-1", vitest, "manual");
    const validation = runValidationEngine({ ...baseArgs(), selections });
    const blocker = validation.issues.find((i) => i.severity === "blocker")!;
    const updated = acknowledgeValidationIssue(
      validation,
      blocker.id,
      "I want this anyway",
      "user-1",
    );
    expect(updated.issues.find((i) => i.id === blocker.id)?.override).toBeUndefined();
    expect(updated.canExport).toBe(false);
  });
});
