import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@contracts/catalog";
import type { Project } from "@contracts/project";

import { createDraftProject } from "../domain/project";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { acceptCatalogSelection } from "../domain/selections";
import { SYSTEM_CATALOG_ITEMS } from "../catalog/systemCatalog";
import {
  buildFileSet,
  pathCollisionKey,
  scanForSecretPatterns,
  validatePackagePath,
} from "../domain/packageGenerator";

const frontendAgent = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "agent-frontend-engineer")!;
if (frontendAgent.kind !== "agent")
  throw new Error("fixture: agent-frontend-engineer must be kind 'agent'");
const codeReviewSkill = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "skill-code-review")!;
const readmeDoc = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "document-template-readme")!;

function makeProject(overrides: Partial<Project> = {}): Project {
  const project = createDraftProject(
    {
      name: "Sample Project",
      idea: "An idea",
      problem: "A problem",
      proposedSolution: "A fix",
      experienceProfile: "advanced",
    },
    DEFAULT_SETTINGS,
    "2026-08-15T00:00:00.000Z",
  );
  return { ...project, ...overrides };
}

function buildInput(project: Project, catalogItems: CatalogItem[] = SYSTEM_CATALOG_ITEMS) {
  return {
    project,
    catalogItems,
    catalogVersion: "test-catalog-1",
    ruleSetVersion: "test-rules-1",
  };
}

describe("validatePackagePath (FR-040, AC-025)", () => {
  it.each([
    ["", "PATH_EMPTY"],
    ["/abs/path.md", "PATH_ABSOLUTE"],
    ["C:/windows/path.md", "PATH_DRIVE_PREFIX"],
    ["\\\\server\\share\\file.md", "PATH_UNC_PREFIX"],
    ["../escape.md", "PATH_TRAVERSAL_SEGMENT"],
    ["a/../b.md", "PATH_TRAVERSAL_SEGMENT"],
    ["a//b.md", "PATH_EMPTY_SEGMENT"],
    ["docs/CON.md", "PATH_RESERVED_NAME"],
    ["docs/file?.md", "PATH_INVALID_CHARACTER"],
  ])("rejects %s as %s", (path, code) => {
    expect(validatePackagePath(path)).toBe(code);
  });

  it("accepts a normal relative path", () => {
    expect(validatePackagePath("docs/REQUIREMENTS.md")).toBeUndefined();
  });

  it("detects Unicode/case-fold collisions via pathCollisionKey", () => {
    expect(pathCollisionKey("Docs/Skill.md")).toBe(pathCollisionKey("docs/skill.md"));
  });
});

describe("scanForSecretPatterns (FR-039, AC-024)", () => {
  it("flags an AWS-style access key", () => {
    expect(scanForSecretPatterns("key=AKIAABCDEFGHIJKLMNOP")).toContain("aws-access-key-id");
  });

  it("does not flag ordinary prose", () => {
    expect(scanForSecretPatterns("This document describes the deployment process.")).toHaveLength(
      0,
    );
  });
});

describe("buildFileSet — core files (FR-037, FR-043)", () => {
  it("includes CLAUDE.md and project.config.json by default, rendered with project data", () => {
    const project = makeProject();
    const { files, issues } = buildFileSet(buildInput(project));
    expect(issues.filter((i) => i.severity === "blocker")).toHaveLength(0);
    const claudeMd = files.find((f) => f.path === "CLAUDE.md");
    expect(claudeMd?.content).toContain("Sample Project");
    const configJson = files.find((f) => f.path === "project.config.json");
    expect(() => JSON.parse(configJson!.content)).not.toThrow();
  });

  it("omits CLAUDE.md when packageSettings.includeClaudeMd is false", () => {
    const project = makeProject();
    project.packageSettings.includeClaudeMd = false;
    const { files } = buildFileSet(buildInput(project));
    expect(files.some((f) => f.path === "CLAUDE.md")).toBe(false);
  });
});

describe("buildFileSet — selected agent/skill/document resources (FR-039, FR-043)", () => {
  it("includes the real agent template for a selected agent, with a missing-mapping-free registry", () => {
    const project = makeProject();
    project.selections = acceptCatalogSelection(
      project.selections,
      project.id,
      frontendAgent,
      "manual",
    );
    const { files, issues } = buildFileSet(buildInput(project));
    expect(issues.some((i) => i.code === "MISSING_TEMPLATE_MAPPING")).toBe(false);
    const agentFile = files.find((f) => f.path === ".claude/agents/frontend-engineer.md");
    expect(agentFile).toBeDefined();
    expect(agentFile?.content).toContain("Sample Project");
  });

  it("includes the real skill template for a selected skill", () => {
    const project = makeProject();
    project.selections = acceptCatalogSelection(
      project.selections,
      project.id,
      codeReviewSkill,
      "manual",
    );
    const { files } = buildFileSet(buildInput(project));
    expect(files.some((f) => f.path === ".claude/skills/code-review/SKILL.md")).toBe(true);
  });

  it("includes an optional document-template item at its declared output path", () => {
    const project = makeProject();
    project.selections = acceptCatalogSelection(
      project.selections,
      project.id,
      readmeDoc,
      "manual",
    );
    const { files } = buildFileSet(buildInput(project));
    expect(files.some((f) => f.path === "README.md")).toBe(true);
  });

  it("reports a blocker, not an empty file, when a selected item's template mapping is missing", () => {
    const brokenAgent: CatalogItem = {
      ...frontendAgent,
      id: "agent-without-template",
      details: { ...frontendAgent.details, contentTemplateId: "agent-template-does-not-exist" },
    };
    const project = makeProject();
    project.selections = acceptCatalogSelection(
      project.selections,
      project.id,
      brokenAgent,
      "manual",
    );
    const { files, issues } = buildFileSet(
      buildInput(project, [...SYSTEM_CATALOG_ITEMS, brokenAgent]),
    );
    const blocker = issues.find((i) => i.code === "MISSING_TEMPLATE_MAPPING");
    expect(blocker?.severity).toBe("blocker");
    expect(files.some((f) => f.sourceId === "agent-without-template")).toBe(false);
  });

  it("does not include an agent/skill/document item when the matching include flag is off", () => {
    const project = makeProject();
    project.selections = acceptCatalogSelection(
      project.selections,
      project.id,
      frontendAgent,
      "manual",
    );
    project.packageSettings.includeAgents = false;
    const { files } = buildFileSet(buildInput(project));
    expect(files.some((f) => f.path.startsWith(".claude/agents/"))).toBe(false);
  });
});

describe("buildFileSet — exclusion and text overrides", () => {
  it("omits an excludable file listed in excludedOptionalPaths", () => {
    const project = makeProject();
    project.packageSettings.excludedOptionalPaths = ["docs/PROJECT_BRIEF.md"];
    const { files } = buildFileSet(buildInput(project));
    expect(files.some((f) => f.path === "docs/PROJECT_BRIEF.md")).toBe(false);
    expect(files.some((f) => f.path === "docs/REQUIREMENTS.md")).toBe(true);
  });

  it("applies a text override on top of the rendered template", () => {
    const project = makeProject();
    project.packageSettings.textOverrides = { "docs/ROADMAP.md": "# Custom roadmap" };
    const { files } = buildFileSet(buildInput(project));
    expect(files.find((f) => f.path === "docs/ROADMAP.md")?.content).toBe("# Custom roadmap");
  });

  it("blocks export when a text override contains a secret-like pattern", () => {
    const project = makeProject();
    project.packageSettings.textOverrides = {
      "docs/ROADMAP.md": "AWS_SECRET_ACCESS_KEY=abcdefghij1234567890",
    };
    const { issues } = buildFileSet(buildInput(project));
    expect(issues.some((i) => i.code === "SECRET_PATTERN_DETECTED")).toBe(true);
  });
});

describe("buildFileSet — determinism (FR-041, AC-026)", () => {
  it("produces identical paths, order, and content across repeated calls on the same input", () => {
    const project = makeProject();
    project.selections = acceptCatalogSelection(
      project.selections,
      project.id,
      frontendAgent,
      "manual",
    );
    const first = buildFileSet(buildInput(project));
    const second = buildFileSet(buildInput(project));
    expect(second.files.map((f) => f.path)).toEqual(first.files.map((f) => f.path));
    expect(second.files.map((f) => f.content)).toEqual(first.files.map((f) => f.content));
    expect(second.issues).toEqual(first.issues);
  });

  it("sorts files in stable lexical path order", () => {
    const project = makeProject();
    const { files } = buildFileSet(buildInput(project));
    const paths = files.map((f) => f.path);
    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
  });
});
