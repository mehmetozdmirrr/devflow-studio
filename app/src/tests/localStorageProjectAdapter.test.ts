import { beforeEach, describe, expect, it } from "vitest";

import {
  LocalStorageProjectAdapter,
  PROJECTS_STAGED_STORAGE_KEY,
  PROJECTS_STORAGE_KEY,
  PROJECTS_STORAGE_SOFT_QUOTA_BYTES,
  ProjectImportValidationError,
} from "../adapters/localStorageProjectAdapter";
import { SETTINGS_STORAGE_KEY } from "../adapters/localStorageSettingsAdapter";
import { PROJECT_SCHEMA_VERSION, createDraftProject } from "../domain/project";
import { cloneDefaultSettings } from "../domain/settings";
import { buildBackupPayload } from "../domain/projectBackup";

const settings = cloneDefaultSettings();

function makeProject(name: string) {
  return createDraftProject(
    {
      name,
      idea: "idea",
      problem: "problem",
      proposedSolution: "solution",
      experienceProfile: "beginner",
    },
    settings,
  );
}

describe("LocalStorageProjectAdapter staged-write protocol (NFR-008)", () => {
  let adapter: LocalStorageProjectAdapter;

  beforeEach(() => {
    adapter = new LocalStorageProjectAdapter();
  });

  it("saves and reads back a project, cleaning up the staged key", async () => {
    const project = makeProject("Alpha");
    await adapter.save(project);

    const list = await adapter.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(project.id);
    expect(window.localStorage.getItem(PROJECTS_STAGED_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(PROJECTS_STORAGE_KEY)).not.toBeNull();
  });

  it("upserts an existing project by id instead of duplicating it", async () => {
    const project = makeProject("Alpha");
    await adapter.save(project);
    const renamed = { ...project, meta: { ...project.meta, name: "Alpha Renamed" } };
    await adapter.save(renamed);

    const list = await adapter.list();
    expect(list).toHaveLength(1);
    expect(list[0].meta.name).toBe("Alpha Renamed");
  });

  it("falls back to last-known-good when current storage fails checksum validation", async () => {
    const a = makeProject("Alpha");
    await adapter.save(a);
    const b = makeProject("Beta");
    await adapter.save(b);

    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const envelope = JSON.parse(raw as string) as { checksum: string };
    envelope.checksum = "0".repeat(64);
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(envelope));

    const list = await adapter.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(a.id);
  });

  it("rejects an unknown future schema version non-destructively", async () => {
    const project = makeProject("Alpha");
    const payload = [project];
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const checksum = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const futureVersion = PROJECT_SCHEMA_VERSION + 1;
    const envelope = {
      schemaVersion: futureVersion,
      applicationVersion: "test",
      writtenAt: new Date().toISOString(),
      checksum,
      payload,
    };
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(envelope));

    await expect(adapter.list()).rejects.toThrow();
    expect(window.localStorage.getItem(PROJECTS_STORAGE_KEY)).toContain(String(futureVersion));
  });

  it("warns but still writes when the candidate exceeds the soft quota", async () => {
    const huge = makeProject("Huge");
    huge.brief.idea = "x".repeat(PROJECTS_STORAGE_SOFT_QUOTA_BYTES + 500);

    const result = await adapter.writeList([huge]);
    expect(result.quotaWarning).toBe(true);

    const list = await adapter.list();
    expect(list).toHaveLength(1);
  });

  it("permanently deletes a project", async () => {
    const a = makeProject("Alpha");
    const b = makeProject("Beta");
    await adapter.save(a);
    await adapter.save(b);

    await adapter.deletePermanently(a.id);

    const list = await adapter.list();
    expect(list.map((project) => project.id)).toEqual([b.id]);
  });

  it("exports a backup payload containing the current project list", async () => {
    const a = makeProject("Alpha");
    await adapter.save(a);

    const backup = await adapter.exportBackup();
    expect(backup.backupVersion).toBe(1);
    expect(backup.projects).toHaveLength(1);
    expect(backup.projects[0].id).toBe(a.id);
    expect(backup.userCatalogItems).toEqual([]);
  });

  it("rejects a malformed import payload without touching existing data", async () => {
    const a = makeProject("Alpha");
    await adapter.save(a);

    await expect(adapter.importBackup({ not: "a backup" })).rejects.toThrow(
      ProjectImportValidationError,
    );

    const list = await adapter.list();
    expect(list).toHaveLength(1);
  });

  it("replaces the current list with a validated import candidate", async () => {
    const a = makeProject("Alpha");
    await adapter.save(a);
    const b = makeProject("Beta");
    const candidate = buildBackupPayload([b], []);

    await adapter.importBackup(candidate);

    const list = await adapter.list();
    expect(list.map((project) => project.id)).toEqual([b.id]);
  });

  it("never writes to the settings storage key, even when the backup includes a settings snapshot", async () => {
    const a = makeProject("Alpha");
    const candidate = buildBackupPayload([a], [], settings);

    await adapter.importBackup(candidate);

    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
  });
});
