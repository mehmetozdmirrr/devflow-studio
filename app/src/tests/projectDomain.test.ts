import { describe, expect, it } from "vitest";
import type { Project } from "@contracts/project";

import {
  PROJECT_SCHEMA_VERSION,
  archiveProject,
  cloneProject,
  createDraftProject,
  isProjectListShape,
  isProjectShape,
  restoreProject,
  slugify,
  trashProject,
  unarchiveProject,
  validateBriefField,
  validateCreateProjectInput,
  validateProjectName,
  type CreateProjectInput,
} from "../domain/project";
import { cloneDefaultSettings } from "../domain/settings";
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  MissingMigrationStepError,
  PROJECT_MIGRATIONS,
  UnknownFutureSchemaVersionError,
  applyMigrations,
} from "../domain/projectMigrations";
import { diffProjectImport, migrateBackupPayloadProjects } from "../domain/projectBackup";

const settings = cloneDefaultSettings();

const validInput: CreateProjectInput = {
  name: "Test Project",
  idea: "An idea",
  problem: "A problem",
  proposedSolution: "A solution",
  experienceProfile: "beginner",
};

describe("createDraftProject", () => {
  it("creates a valid draft with expected defaults", () => {
    const project = createDraftProject(validInput, settings);
    expect(project.status).toBe("draft");
    expect(project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(project.revision).toBe(0);
    expect(project.meta.name).toBe("Test Project");
    expect(project.meta.slug).toBe("test-project");
    expect(project.configuration.experienceProfile).toBe("beginner");
    expect(project.configuration.selectionMode).toBe(settings.defaultSelectionMode);
    expect(project.validation.canExport).toBe(false);
    expect(isProjectShape(project)).toBe(true);
  });

  it("generates unique ids across two creations", () => {
    const a = createDraftProject(validInput, settings);
    const b = createDraftProject(validInput, settings);
    expect(a.id).not.toBe(b.id);
  });
});

describe("slugify", () => {
  it("lowercases, strips diacritics, and hyphenates", () => {
    expect(slugify("Café Löve  Project!")).toBe("cafe-love-project");
  });

  it("falls back to 'project' for an all-symbol name", () => {
    expect(slugify("???")).toBe("project");
  });
});

describe("field validators", () => {
  it("rejects blank name and blank brief fields", () => {
    expect(validateProjectName("   ")).toBe("required");
    expect(validateBriefField("")).toBe("required");
  });

  it("rejects overlong values", () => {
    expect(validateProjectName("a".repeat(161))).toBe("tooLong");
    expect(validateBriefField("a".repeat(4001))).toBe("tooLong");
  });

  it("accepts a valid create input", () => {
    expect(validateCreateProjectInput(validInput)).toEqual({});
  });
});

describe("cloneProject (FR-004)", () => {
  it("creates a new id/name and does not mutate the source", () => {
    const source = createDraftProject(validInput, settings);
    const archived = archiveProject(source);
    const clone = cloneProject(archived);

    expect(clone.id).not.toBe(archived.id);
    expect(clone.meta.name).toBe(`${archived.meta.name} (copy)`);
    expect(clone.status).toBe("draft");
    expect(clone.archivedAt).toBeUndefined();
    expect(clone.revision).toBe(0);

    expect(archived.status).toBe("archived");
    expect(archived.archivedAt).toBeDefined();
  });

  it("deep-copies mutable arrays so editing the clone never touches the source", () => {
    const source = createDraftProject(validInput, settings);
    const clone = cloneProject(source);
    clone.meta.tags.push("x");
    expect(source.meta.tags).toEqual([]);
  });
});

describe("trash/restore preserves archive state without a contract change", () => {
  it("restoring a trashed draft returns to draft", () => {
    const draft = createDraftProject(validInput, settings);
    const trashed = trashProject(draft);
    expect(trashed.archivedAt).toBeUndefined();
    const restored = restoreProject(trashed);
    expect(restored.status).toBe("draft");
    expect(restored.trashedAt).toBeUndefined();
  });

  it("restoring a trashed archived project returns to archived, not draft", () => {
    const draft = createDraftProject(validInput, settings);
    const archived = archiveProject(draft);
    const trashed = trashProject(archived);
    expect(trashed.archivedAt).toBe(archived.archivedAt);
    expect(trashed.status).toBe("trashed");

    const restored = restoreProject(trashed);
    expect(restored.status).toBe("archived");
    expect(restored.archivedAt).toBe(archived.archivedAt);
    expect(restored.trashedAt).toBeUndefined();
  });

  it("unarchiving clears archivedAt", () => {
    const draft = createDraftProject(validInput, settings);
    const archived = archiveProject(draft);
    const back = unarchiveProject(archived);
    expect(back.status).toBe("draft");
    expect(back.archivedAt).toBeUndefined();
  });
});

describe("isProjectListShape", () => {
  it("accepts a list of valid projects and rejects malformed entries", () => {
    const project = createDraftProject(validInput, settings);
    expect(isProjectListShape([project])).toBe(true);
    expect(isProjectListShape([{ ...project, meta: undefined }])).toBe(false);
    expect(isProjectListShape("not-a-list")).toBe(false);
  });

  it("rejects a project whose configuration is missing customDomainLabels (unmigrated v1 shape)", () => {
    const project = createDraftProject(validInput, settings);
    const v1Configuration: Record<string, unknown> = { ...project.configuration };
    delete v1Configuration.customDomainLabels;
    expect(isProjectListShape([{ ...project, configuration: v1Configuration }])).toBe(false);
  });
});

describe("defaultProjectConfiguration / cloneProject customDomainLabels", () => {
  it("defaults customDomainLabels to an empty object", () => {
    const project = createDraftProject(validInput, settings);
    expect(project.configuration.customDomainLabels).toEqual({});
  });

  it("clone deep-copies customDomainLabels so editing the clone never touches the source", () => {
    const source = createDraftProject(validInput, settings);
    source.configuration.customDomainLabels = { "custom-x": "X" };
    const clone = cloneProject(source);
    clone.configuration.customDomainLabels["custom-y"] = "Y";
    expect(source.configuration.customDomainLabels).toEqual({ "custom-x": "X" });
  });
});

describe("applyMigrations mechanism (synthetic registry, NFR-008)", () => {
  it("applies sequential migrations vN -> vN+1 without skipping", () => {
    const registry = {
      1: (payload: unknown) => ({ ...(payload as object), migratedFrom1: true }),
      2: (payload: unknown) => ({ ...(payload as object), migratedFrom2: true }),
    };
    const result = applyMigrations({ a: 1 }, 1, 3, registry);
    expect(result.migrated).toBe(true);
    expect(result.value).toEqual({ a: 1, migratedFrom1: true, migratedFrom2: true });
  });

  it("is a no-op when fromVersion equals toVersion", () => {
    const result = applyMigrations({ a: 1 }, 1, 1, {});
    expect(result.migrated).toBe(false);
    expect(result.value).toEqual({ a: 1 });
  });

  it("rejects an unknown future version non-destructively", () => {
    expect(() => applyMigrations({ a: 1 }, 3, 1, {})).toThrow(UnknownFutureSchemaVersionError);
  });

  it("throws if an intermediate migration step is missing (never skips)", () => {
    const registry = { 1: (payload: unknown) => payload };
    expect(() => applyMigrations({ a: 1 }, 1, 3, registry)).toThrow(MissingMigrationStepError);
  });
});

describe("PROJECT_MIGRATIONS v1 -> v2 (customDomainLabels, NFR-008)", () => {
  it("adds an empty customDomainLabels map to a v1 project missing it", () => {
    const project = createDraftProject(validInput, settings);
    const v1Configuration: Record<string, unknown> = { ...project.configuration };
    delete v1Configuration.customDomainLabels;
    const v1Payload = [{ ...project, schemaVersion: 1, configuration: v1Configuration }];

    const result = applyMigrations(
      v1Payload,
      1,
      CURRENT_PROJECT_SCHEMA_VERSION,
      PROJECT_MIGRATIONS,
    );

    expect(result.migrated).toBe(true);
    const migratedList = result.value as Project[];
    expect(migratedList[0].schemaVersion).toBe(2);
    expect(migratedList[0].configuration.customDomainLabels).toEqual({});
  });

  it("is idempotent: a project that already has customDomainLabels is left untouched by content", () => {
    const project = createDraftProject(validInput, settings);
    project.configuration.customDomainLabels = { "custom-x": "X" };
    const result = applyMigrations(
      [project],
      1,
      CURRENT_PROJECT_SCHEMA_VERSION,
      PROJECT_MIGRATIONS,
    );
    const migratedList = result.value as (typeof project)[];
    expect(migratedList[0].configuration.customDomainLabels).toEqual({ "custom-x": "X" });
  });
});

describe("migrateBackupPayloadProjects (mixed-version backup import)", () => {
  it("migrates only the projects that need it and preserves already-current ones", () => {
    const current = createDraftProject(validInput, settings);
    const v1Configuration: Record<string, unknown> = { ...current.configuration };
    delete v1Configuration.customDomainLabels;
    const legacy = {
      ...current,
      id: "legacy-id",
      schemaVersion: 1,
      configuration: v1Configuration,
    };
    const candidate = {
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      projects: [current, legacy],
      userCatalogItems: [],
    };

    const migrated = migrateBackupPayloadProjects(candidate) as {
      projects: Project[];
    };

    expect(migrated.projects).toHaveLength(2);
    for (const migratedProject of migrated.projects) {
      expect(migratedProject.schemaVersion).toBe(2);
      expect(migratedProject.configuration.customDomainLabels).toBeDefined();
    }
  });

  it("passes through a non-backup-shaped value unchanged", () => {
    expect(migrateBackupPayloadProjects({ nope: true })).toEqual({ nope: true });
    expect(migrateBackupPayloadProjects("not an object")).toBe("not an object");
  });
});

describe("diffProjectImport", () => {
  it("separates new projects from ID conflicts without writing anything", () => {
    const existing = createDraftProject(validInput, settings);
    const newIncoming = createDraftProject(validInput, settings);
    const conflictingIncoming = { ...existing, meta: { ...existing.meta, name: "Renamed" } };

    const diff = diffProjectImport([existing], [newIncoming, conflictingIncoming]);

    expect(diff.newProjects).toEqual([newIncoming]);
    expect(diff.conflicts).toHaveLength(1);
    expect(diff.conflicts[0].id).toBe(existing.id);
    expect(diff.conflicts[0].existing).toBe(existing);
    expect(diff.conflicts[0].incoming).toBe(conflictingIncoming);
  });
});
