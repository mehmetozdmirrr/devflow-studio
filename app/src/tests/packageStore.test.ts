import { describe, expect, it } from "vitest";

import { createDraftProject } from "../domain/project";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { SYSTEM_CATALOG_ITEMS } from "../catalog/systemCatalog";
import { computePackageBuildResult } from "../application/packageStore";

function makeProject() {
  return createDraftProject(
    {
      name: "Store Test Project",
      idea: "Idea",
      problem: "Problem",
      proposedSolution: "Solution",
      experienceProfile: "beginner",
    },
    DEFAULT_SETTINGS,
    "2026-08-15T00:00:00.000Z",
  );
}

describe("computePackageBuildResult (FR-041, AC-026)", () => {
  it("produces a schema-shaped manifest with matching file hashes and canExport=true for a clean project", async () => {
    const project = makeProject();
    const result = await computePackageBuildResult(project, SYSTEM_CATALOG_ITEMS);

    expect(result.manifest.schemaVersion).toBe(1);
    expect(result.manifest.projectId).toBe(project.id);
    expect(result.manifest.files).toHaveLength(result.files.length);
    expect(result.canExport).toBe(true);

    for (const file of result.files) {
      const manifestEntry = result.manifest.files.find((entry) => entry.path === file.path);
      expect(manifestEntry?.contentHash).toBe(file.contentHash);
    }
  });

  it("computes a content hash over the exact UTF-8 bytes, not a JSON-escaped string", async () => {
    const project = makeProject();
    const result = await computePackageBuildResult(project, SYSTEM_CATALOG_ITEMS);
    const claudeMd = result.files.find((file) => file.path === "CLAUDE.md")!;

    const expectedHash = await crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(claudeMd.content))
      .then((digest) =>
        Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join(""),
      );
    expect(claudeMd.contentHash).toBe(expectedHash);
  });

  it("produces the same manifest file order and hashes on repeated calls (determinism, AC-026)", async () => {
    const project = makeProject();
    const first = await computePackageBuildResult(project, SYSTEM_CATALOG_ITEMS);
    const second = await computePackageBuildResult(project, SYSTEM_CATALOG_ITEMS);
    expect(second.manifest.files).toEqual(first.manifest.files);
  });
});
