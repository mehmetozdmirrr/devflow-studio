import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  selectVisibleProjects,
  useProjectsStore,
  type CreateProjectResult,
} from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { PROJECTS_STORAGE_KEY } from "../adapters/localStorageProjectAdapter";
import type { CreateProjectInput } from "../domain/project";

function resetStores(): void {
  useProjectsStore.setState({
    projects: [],
    hydrated: false,
    loadError: null,
    dirtyProjectIds: new Set(),
    saveErrorsByProjectId: {},
    trashUndo: null,
    searchQuery: "",
    statusFilter: "all",
    sortBy: "updatedAt",
  });
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai } },
    hydrated: true,
    undoSnapshot: null,
  });
}

beforeEach(() => {
  resetStores();
});

const validInput: CreateProjectInput = {
  name: "Alpha",
  idea: "idea",
  problem: "problem",
  proposedSolution: "solution",
  experienceProfile: "beginner",
};

async function createOrThrow(input: CreateProjectInput = validInput) {
  const result: CreateProjectResult = await useProjectsStore.getState().createProject(input);
  if (!result.ok) throw new Error(`setup failed: ${JSON.stringify(result.errors)}`);
  return result.project;
}

describe("createProject (FR-001)", () => {
  it("persists a valid project and adds it to state", async () => {
    const project = await createOrThrow();
    expect(useProjectsStore.getState().projects).toHaveLength(1);
    expect(useProjectsStore.getState().projects[0].id).toBe(project.id);
    expect(window.localStorage.getItem(PROJECTS_STORAGE_KEY)).not.toBeNull();
  });

  it("returns field errors and does not persist an invalid project", async () => {
    const result = await useProjectsStore.getState().createProject({ ...validInput, name: "" });
    expect(result.ok).toBe(false);
    expect(useProjectsStore.getState().projects).toHaveLength(0);
  });
});

describe("selectVisibleProjects (FR-002)", () => {
  it("filters out trashed projects, applies status filter, and sorts deterministically", async () => {
    const zebra = await createOrThrow({ ...validInput, name: "Zebra" });
    const apple = await createOrThrow({ ...validInput, name: "Apple" });
    await useProjectsStore.getState().archiveProject(apple.id);

    useProjectsStore.getState().setSortBy("name");
    const visibleAll = selectVisibleProjects(useProjectsStore.getState());
    expect(visibleAll.map((project) => project.meta.name)).toEqual(["Apple", "Zebra"]);

    useProjectsStore.getState().setStatusFilter("draft");
    const onlyDraft = selectVisibleProjects(useProjectsStore.getState());
    expect(onlyDraft.map((project) => project.id)).toEqual([zebra.id]);

    useProjectsStore.getState().setStatusFilter("all");
    useProjectsStore.getState().setSearchQuery("zeb");
    const searched = selectVisibleProjects(useProjectsStore.getState());
    expect(searched.map((project) => project.id)).toEqual([zebra.id]);
  });
});

describe("cloneProject (FR-004)", () => {
  it("creates a separate project and does not modify the source", async () => {
    const created = await createOrThrow();
    const clone = await useProjectsStore.getState().cloneProject(created.id);
    expect(clone).not.toBeNull();
    expect(clone?.id).not.toBe(created.id);

    const projects = useProjectsStore.getState().projects;
    expect(projects).toHaveLength(2);
    const source = projects.find((project) => project.id === created.id);
    expect(source?.meta.name).toBe(created.meta.name);
    expect(source?.status).toBe("draft");
  });
});

describe("trash/restore preserves archive state (FR-005)", () => {
  it("restores an archived-then-trashed project back to archived, not draft", async () => {
    const created = await createOrThrow();
    const id = created.id;

    await useProjectsStore.getState().archiveProject(id);
    await useProjectsStore.getState().trashProject(id);
    expect(useProjectsStore.getState().projects.find((project) => project.id === id)?.status).toBe(
      "trashed",
    );
    expect(useProjectsStore.getState().trashUndo?.id).toBe(id);

    await useProjectsStore.getState().restoreFromTrash(id);
    const restored = useProjectsStore.getState().projects.find((project) => project.id === id);
    expect(restored?.status).toBe("archived");
    expect(restored?.archivedAt).toBeDefined();
  });

  it("undoTrash restores the exact pre-trash project", async () => {
    const created = await createOrThrow();
    const id = created.id;

    await useProjectsStore.getState().trashProject(id);
    expect(useProjectsStore.getState().projects.find((project) => project.id === id)?.status).toBe(
      "trashed",
    );

    await useProjectsStore.getState().undoTrash();
    const restored = useProjectsStore.getState().projects.find((project) => project.id === id);
    expect(restored?.status).toBe("draft");
    expect(useProjectsStore.getState().trashUndo).toBeNull();
  });

  it("permanentlyDelete removes the project entirely", async () => {
    const created = await createOrThrow();
    await useProjectsStore.getState().permanentlyDelete(created.id);
    expect(useProjectsStore.getState().projects).toHaveLength(0);
  });
});

describe("updateProjectDraft + autosave (AC-003)", () => {
  it("autosave enabled: debounces then persists, bumping revision only after success", async () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, autosaveEnabled: true },
    }));
    const created = await createOrThrow();
    const id = created.id;

    useProjectsStore.getState().updateProjectDraft(id, { name: "Updated Name" });
    expect(useProjectsStore.getState().dirtyProjectIds.has(id)).toBe(true);
    expect(
      useProjectsStore.getState().projects.find((project) => project.id === id)?.revision,
    ).toBe(created.revision);

    // Real (not fake) timers: the debounce is a fixed, short constant, so a bounded
    // real wait past it is deterministic without needing to fake crypto.subtle's async chain.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(useProjectsStore.getState().dirtyProjectIds.has(id)).toBe(false);
    const saved = useProjectsStore.getState().projects.find((project) => project.id === id);
    expect(saved?.meta.name).toBe("Updated Name");
    expect(saved?.revision).toBe(created.revision + 1);
    expect(window.localStorage.getItem(PROJECTS_STORAGE_KEY)).toContain("Updated Name");
  }, 10000);

  it("autosave disabled: stays dirty until an explicit save, revision unchanged until then", async () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, autosaveEnabled: false },
    }));
    const created = await createOrThrow();
    const id = created.id;

    useProjectsStore.getState().updateProjectDraft(id, { name: "Still Dirty" });
    expect(useProjectsStore.getState().dirtyProjectIds.has(id)).toBe(true);
    expect(
      useProjectsStore.getState().projects.find((project) => project.id === id)?.revision,
    ).toBe(created.revision);

    await useProjectsStore.getState().saveProjectNow(id);
    const saved = useProjectsStore.getState().projects.find((project) => project.id === id);
    expect(saved?.meta.name).toBe("Still Dirty");
    expect(saved?.revision).toBe(created.revision + 1);
    expect(useProjectsStore.getState().dirtyProjectIds.has(id)).toBe(false);
  });

  it("keeps the in-memory edit and reports a storage error when persistence fails", async () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, autosaveEnabled: false },
    }));
    const created = await createOrThrow();
    const id = created.id;

    useProjectsStore.getState().updateProjectDraft(id, { name: "Will Fail" });

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("simulated storage failure");
    });
    try {
      await useProjectsStore.getState().saveProjectNow(id);
    } finally {
      setItemSpy.mockRestore();
    }

    expect(useProjectsStore.getState().saveErrorsByProjectId[id]).toBe("storage");
    expect(useProjectsStore.getState().dirtyProjectIds.has(id)).toBe(true);
    expect(
      useProjectsStore.getState().projects.find((project) => project.id === id)?.meta.name,
    ).toBe("Will Fail");
  });

  it("does not persist and marks an invalid error when the field fails validation", async () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, autosaveEnabled: false },
    }));
    const created = await createOrThrow();
    const id = created.id;

    useProjectsStore.getState().updateProjectDraft(id, { name: "   " });
    await useProjectsStore.getState().saveProjectNow(id);

    expect(useProjectsStore.getState().saveErrorsByProjectId[id]).toBe("invalid");
    expect(useProjectsStore.getState().dirtyProjectIds.has(id)).toBe(true);
  });
});

describe("import preview/commit (FR-006)", () => {
  it("previewImport diffs new vs conflicting projects without writing", async () => {
    const existing = await createOrThrow();

    const backup = {
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      projects: [
        { ...existing, meta: { ...existing.meta, name: "Conflicting Rename" } },
        { ...existing, id: "project-new-one", meta: { ...existing.meta, name: "Brand New" } },
      ],
      userCatalogItems: [],
    };

    const result = useProjectsStore.getState().previewImport(backup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.diff.newProjects).toHaveLength(1);
    expect(result.preview.diff.conflicts).toHaveLength(1);
    expect(useProjectsStore.getState().projects).toHaveLength(1);
  });

  it("rejects a malformed candidate", () => {
    const result = useProjectsStore.getState().previewImport({ nope: true });
    expect(result.ok).toBe(false);
  });

  it("commitImport merges resolved conflicts and new projects, and never applies settings without opt-in", async () => {
    const existing = await createOrThrow();

    const backup = {
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      projects: [
        { ...existing, meta: { ...existing.meta, name: "Conflicting Rename" } },
        { ...existing, id: "project-new-one", meta: { ...existing.meta, name: "Brand New" } },
      ],
      userCatalogItems: [],
      settings: { ...useSettingsStore.getState().settings, theme: "dark" as const },
    };
    const preview = useProjectsStore.getState().previewImport(backup);
    if (!preview.ok) throw new Error("preview failed");

    const conflictId = preview.preview.diff.conflicts[0].id;
    await useProjectsStore
      .getState()
      .commitImport(preview.preview, { [conflictId]: "imported" }, false);

    const projects = useProjectsStore.getState().projects;
    expect(projects).toHaveLength(2);
    expect(projects.find((project) => project.id === existing.id)?.meta.name).toBe(
      "Conflicting Rename",
    );
    expect(projects.some((project) => project.meta.name === "Brand New")).toBe(true);
    expect(useSettingsStore.getState().settings.theme).not.toBe("dark");
  });

  it("migrates a Phase 2 (v1) backup missing customDomainLabels and imports it as v2 without losing data", async () => {
    const current = await createOrThrow();
    const v1Configuration: Record<string, unknown> = { ...current.configuration };
    delete v1Configuration.customDomainLabels;
    const v1Project = {
      ...current,
      id: "project-legacy-v1",
      schemaVersion: 1,
      meta: { ...current.meta, name: "Legacy V1 Project" },
      configuration: v1Configuration,
    };

    const backup = {
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      projects: [v1Project],
      userCatalogItems: [],
    };

    const preview = useProjectsStore.getState().previewImport(backup);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.preview.diff.newProjects).toHaveLength(1);
    const migratedPreviewProject = preview.preview.diff.newProjects[0];
    expect(migratedPreviewProject.schemaVersion).toBe(2);
    expect(migratedPreviewProject.configuration.customDomainLabels).toEqual({});

    await useProjectsStore.getState().commitImport(preview.preview, {}, false);

    const imported = useProjectsStore
      .getState()
      .projects.find((project) => project.id === "project-legacy-v1");
    expect(imported).toBeDefined();
    expect(imported?.schemaVersion).toBe(2);
    expect(imported?.configuration.customDomainLabels).toEqual({});
    expect(imported?.meta.name).toBe("Legacy V1 Project");
    expect(imported?.brief.idea).toBe(current.brief.idea);
  });

  it("commitImport applies settings only when applySettings is explicitly true", async () => {
    const existing = await createOrThrow();

    const backup = {
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      projects: [existing],
      userCatalogItems: [],
      settings: { ...useSettingsStore.getState().settings, theme: "dark" as const },
    };
    const preview = useProjectsStore.getState().previewImport(backup);
    if (!preview.ok) throw new Error("preview failed");

    await useProjectsStore.getState().commitImport(preview.preview, {}, true);

    expect(useSettingsStore.getState().settings.theme).toBe("dark");
  });
});

describe("updateProjectDraft configuration/brief/requirements patches (Phase 3 wizard plumbing)", () => {
  it("merges a configuration patch on top of the existing configuration without dropping other fields", async () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, autosaveEnabled: false },
    }));
    const created = await createOrThrow();

    useProjectsStore.getState().updateProjectDraft(created.id, {
      configuration: { domainIds: ["domain-web"], targetPlatforms: ["web"] },
    });
    await useProjectsStore.getState().saveProjectNow(created.id);

    const saved = useProjectsStore.getState().projects.find((project) => project.id === created.id);
    expect(saved?.configuration.domainIds).toEqual(["domain-web"]);
    expect(saved?.configuration.targetPlatforms).toEqual(["web"]);
    expect(saved?.configuration.selectionMode).toBe(created.configuration.selectionMode);
  });

  it("merges brief array fields without touching idea/problem/proposedSolution", async () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, autosaveEnabled: false },
    }));
    const created = await createOrThrow();

    useProjectsStore.getState().updateProjectDraft(created.id, {
      brief: { targetUsers: ["Solo devs"], goals: ["Ship faster"] },
    });
    await useProjectsStore.getState().saveProjectNow(created.id);

    const saved = useProjectsStore.getState().projects.find((project) => project.id === created.id);
    expect(saved?.brief.targetUsers).toEqual(["Solo devs"]);
    expect(saved?.brief.goals).toEqual(["Ship faster"]);
    expect(saved?.brief.idea).toBe(created.brief.idea);
  });

  it("replaces the requirements list", async () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, autosaveEnabled: false },
    }));
    const created = await createOrThrow();
    const requirement = {
      id: "requirement-1",
      type: "functional" as const,
      title: "Login",
      description: "Users can log in",
      priority: "must" as const,
      status: "draft" as const,
      source: "user" as const,
      tags: [],
      acceptanceCriteria: [],
      verificationMethods: [],
      createdAt: created.createdAt,
      updatedAt: created.createdAt,
    };

    useProjectsStore.getState().updateProjectDraft(created.id, { requirements: [requirement] });
    await useProjectsStore.getState().saveProjectNow(created.id);

    const saved = useProjectsStore.getState().projects.find((project) => project.id === created.id);
    expect(saved?.requirements).toEqual([requirement]);
  });
});

describe("markConfigured (FR-015)", () => {
  it("returns ok:false and leaves status as draft when the wizard is incomplete", async () => {
    const created = await createOrThrow();
    const result = await useProjectsStore.getState().markConfigured(created.id);
    expect(result?.ok).toBe(false);
    expect(useProjectsStore.getState().projects.find((p) => p.id === created.id)?.status).toBe(
      "draft",
    );
  });

  it("flushes a pending dirty edit, then marks configured once every data step is complete", async () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, autosaveEnabled: false },
    }));
    const created = await createOrThrow();

    useProjectsStore.getState().updateProjectDraft(created.id, {
      configuration: { domainIds: ["domain-web"], targetPlatforms: ["web"] },
      brief: { targetUsers: ["Solo devs"], goals: ["Ship faster"] },
      requirements: [
        {
          id: "requirement-1",
          type: "functional",
          title: "Login",
          description: "Users can log in",
          priority: "must",
          status: "draft",
          source: "user",
          tags: [],
          acceptanceCriteria: [],
          verificationMethods: [],
          createdAt: created.createdAt,
          updatedAt: created.createdAt,
        },
        {
          id: "requirement-2",
          type: "non-functional",
          title: "Fast",
          description: "Loads quickly",
          priority: "should",
          status: "draft",
          source: "user",
          tags: [],
          acceptanceCriteria: [],
          verificationMethods: [],
          createdAt: created.createdAt,
          updatedAt: created.createdAt,
        },
      ],
    });
    expect(useProjectsStore.getState().dirtyProjectIds.has(created.id)).toBe(true);

    const result = await useProjectsStore.getState().markConfigured(created.id);

    expect(result?.ok).toBe(true);
    expect(useProjectsStore.getState().dirtyProjectIds.has(created.id)).toBe(false);
    const saved = useProjectsStore.getState().projects.find((p) => p.id === created.id);
    expect(saved?.status).toBe("configured");
    expect(window.localStorage.getItem(PROJECTS_STORAGE_KEY)).toContain("configured");
  });

  it("returns null for an unknown project id", async () => {
    const result = await useProjectsStore.getState().markConfigured("does-not-exist");
    expect(result).toBeNull();
  });
});
