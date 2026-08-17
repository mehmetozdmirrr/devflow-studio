import { create } from "zustand";
import type { Project, ProjectBrief, ProjectConfiguration } from "@contracts/project";
import type { PackageSettings } from "@contracts/package";
import type { ProjectBackupPayload } from "@contracts/storage";
import type { Requirement } from "@contracts/requirement";
import type { ProjectSelection } from "@contracts/selection";
import type { ProjectValidation } from "@contracts/validation";

import {
  archiveProject as archiveProjectDomain,
  cloneProject as cloneProjectDomain,
  configureProject,
  createDraftProject,
  hasFieldErrors,
  restoreProject as restoreProjectDomain,
  trashProject as trashProjectDomain,
  unarchiveProject as unarchiveProjectDomain,
  validateBriefField,
  validateCreateProjectInput,
  validateProjectName,
  type ConfigureProjectResult,
  type CreateProjectInput,
  type ProjectFieldErrors,
} from "../domain/project";
import {
  diffProjectImport,
  isProjectBackupPayloadShape,
  migrateBackupPayloadProjects,
  type ProjectImportDiff,
} from "../domain/projectBackup";
import { LocalStorageProjectAdapter } from "../adapters/localStorageProjectAdapter";
import { LocalStorageSettingsAdapter } from "../adapters/localStorageSettingsAdapter";
import { LocalStorageCatalogAdapter } from "../adapters/localStorageCatalogAdapter";
import { downloadJson } from "../adapters/downloadJson";
import { useSettingsStore } from "./settingsStore";

const repository = new LocalStorageProjectAdapter();
const settingsRepository = new LocalStorageSettingsAdapter();
const catalogRepository = new LocalStorageCatalogAdapter();

const AUTOSAVE_DEBOUNCE_MS = 800;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export type ProjectStatusFilter = "all" | "draft" | "archived";
export type ProjectSortBy = "updatedAt" | "name";
export type ImportConflictResolution = "existing" | "imported";
export type ProjectSaveError = "invalid" | "storage";

export interface ProjectDraftPatch {
  name?: string;
  idea?: string;
  problem?: string;
  proposedSolution?: string;
  /** Wizard array-valued brief fields (targetUsers/goals/successMeasures/constraints) — merged shallowly on top of the existing brief. */
  brief?: Partial<Pick<ProjectBrief, "targetUsers" | "goals" | "successMeasures" | "constraints">>;
  /** Merged shallowly on top of the existing configuration; callers pass whole replacement values for array/record fields. */
  configuration?: Partial<ProjectConfiguration>;
  /** Full replacement list — requirements CRUD is computed in `domain/requirements.ts` before being passed here. */
  requirements?: Requirement[];
  /** Full replacement list — selection CRUD is computed in `domain/selections.ts` before being passed here. */
  selections?: ProjectSelection[];
  /** Full replacement — computed by `domain/validationEngine.ts` before being passed here. */
  validation?: ProjectValidation;
  /** Full replacement — computed by `application/packageStore.ts` before being passed here. */
  packageSettings?: PackageSettings;
}

export interface ImportPreview {
  payload: ProjectBackupPayload;
  diff: ProjectImportDiff;
}

export type ImportPreviewResult =
  { ok: true; preview: ImportPreview } | { ok: false; error: "invalid-shape" };

export type CreateProjectResult =
  { ok: true; project: Project } | { ok: false; errors: ProjectFieldErrors };

interface ProjectsState {
  projects: Project[];
  hydrated: boolean;
  loadError: string | null;
  dirtyProjectIds: Set<string>;
  saveErrorsByProjectId: Record<string, ProjectSaveError>;
  trashUndo: Project | null;
  searchQuery: string;
  statusFilter: ProjectStatusFilter;
  sortBy: ProjectSortBy;

  hydrate: () => Promise<void>;
  setSearchQuery: (value: string) => void;
  setStatusFilter: (value: ProjectStatusFilter) => void;
  setSortBy: (value: ProjectSortBy) => void;

  createProject: (input: CreateProjectInput) => Promise<CreateProjectResult>;
  updateProjectDraft: (id: string, patch: ProjectDraftPatch) => void;
  saveProjectNow: (id: string) => Promise<void>;
  markConfigured: (id: string) => Promise<ConfigureProjectResult | null>;

  cloneProject: (id: string) => Promise<Project | null>;
  archiveProject: (id: string) => Promise<void>;
  unarchiveProject: (id: string) => Promise<void>;
  trashProject: (id: string) => Promise<void>;
  undoTrash: () => Promise<void>;
  dismissTrashUndo: () => void;
  restoreFromTrash: (id: string) => Promise<void>;
  permanentlyDelete: (id: string) => Promise<void>;

  exportBackup: () => Promise<void>;
  previewImport: (candidate: unknown) => ImportPreviewResult;
  commitImport: (
    preview: ImportPreview,
    resolutions: Record<string, ImportConflictResolution>,
    applySettings: boolean,
  ) => Promise<void>;
}

function applyDraftPatch(project: Project, patch: ProjectDraftPatch): Project {
  return {
    ...project,
    meta: patch.name !== undefined ? { ...project.meta, name: patch.name } : project.meta,
    brief: {
      ...project.brief,
      ...(patch.idea !== undefined ? { idea: patch.idea } : {}),
      ...(patch.problem !== undefined ? { problem: patch.problem } : {}),
      ...(patch.proposedSolution !== undefined ? { proposedSolution: patch.proposedSolution } : {}),
      ...(patch.brief ?? {}),
    },
    configuration: patch.configuration
      ? { ...project.configuration, ...patch.configuration }
      : project.configuration,
    requirements: patch.requirements ?? project.requirements,
    selections: patch.selections ?? project.selections,
    validation: patch.validation ?? project.validation,
    packageSettings: patch.packageSettings ?? project.packageSettings,
  };
}

function validateProjectFields(project: Project): ProjectFieldErrors {
  const errors: ProjectFieldErrors = {};
  const nameError = validateProjectName(project.meta.name);
  if (nameError) errors.name = nameError;
  const ideaError = validateBriefField(project.brief.idea);
  if (ideaError) errors.idea = ideaError;
  const problemError = validateBriefField(project.brief.problem);
  if (problemError) errors.problem = problemError;
  const solutionError = validateBriefField(project.brief.proposedSolution);
  if (solutionError) errors.proposedSolution = solutionError;
  return errors;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  hydrated: false,
  loadError: null,
  dirtyProjectIds: new Set(),
  saveErrorsByProjectId: {},
  trashUndo: null,
  searchQuery: "",
  statusFilter: "all",
  sortBy: "updatedAt",

  hydrate: async () => {
    try {
      const projects = await repository.list();
      set({ projects, hydrated: true, loadError: null });
    } catch (error) {
      set({ hydrated: true, loadError: error instanceof Error ? error.message : "unknown" });
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSortBy: (sortBy) => set({ sortBy }),

  createProject: async (input) => {
    const errors = validateCreateProjectInput(input);
    if (hasFieldErrors(errors)) {
      return { ok: false, errors };
    }
    const settings = useSettingsStore.getState().settings;
    const project = createDraftProject(input, settings);
    await repository.save(project);
    set((state) => ({ projects: [...state.projects, project] }));
    return { ok: true, project };
  },

  updateProjectDraft: (id, patch) => {
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id ? applyDraftPatch(project, patch) : project,
      ),
      dirtyProjectIds: new Set(state.dirtyProjectIds).add(id),
    }));

    const existingTimer = debounceTimers.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    const autosaveEnabled = useSettingsStore.getState().settings.autosaveEnabled;
    if (autosaveEnabled) {
      const timer = setTimeout(() => {
        debounceTimers.delete(id);
        void get().saveProjectNow(id);
      }, AUTOSAVE_DEBOUNCE_MS);
      debounceTimers.set(id, timer);
    }
  },

  saveProjectNow: async (id) => {
    const pendingTimer = debounceTimers.get(id);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      debounceTimers.delete(id);
    }

    const project = get().projects.find((candidate) => candidate.id === id);
    if (!project) return;

    const errors = validateProjectFields(project);
    if (hasFieldErrors(errors)) {
      set((state) => ({
        saveErrorsByProjectId: { ...state.saveErrorsByProjectId, [id]: "invalid" },
      }));
      return;
    }

    const now = new Date().toISOString();
    const toPersist: Project = { ...project, updatedAt: now, revision: project.revision + 1 };

    try {
      const saved = await repository.save(toPersist);
      set((state) => {
        const nextDirty = new Set(state.dirtyProjectIds);
        nextDirty.delete(id);
        const nextErrors = { ...state.saveErrorsByProjectId };
        delete nextErrors[id];
        return {
          projects: state.projects.map((candidate) => (candidate.id === id ? saved : candidate)),
          dirtyProjectIds: nextDirty,
          saveErrorsByProjectId: nextErrors,
        };
      });
    } catch {
      set((state) => ({
        saveErrorsByProjectId: { ...state.saveErrorsByProjectId, [id]: "storage" },
      }));
    }
  },

  /** Flushes any pending debounced/dirty edit first so the review reflects the latest saved state, then runs the FR-015 completeness check before transitioning status. */
  markConfigured: async (id) => {
    await get().saveProjectNow(id);
    const project = get().projects.find((candidate) => candidate.id === id);
    if (!project) return null;
    const result = configureProject(project);
    if (!result.ok) return result;
    const saved = await repository.save(result.project);
    set((state) => ({
      projects: state.projects.map((candidate) => (candidate.id === id ? saved : candidate)),
    }));
    return { ok: true, project: saved };
  },

  cloneProject: async (id) => {
    const source = get().projects.find((project) => project.id === id);
    if (!source) return null;
    const clone = cloneProjectDomain(source);
    await repository.save(clone);
    set((state) => ({ projects: [...state.projects, clone] }));
    return clone;
  },

  archiveProject: async (id) => {
    const source = get().projects.find((project) => project.id === id);
    if (!source) return;
    const archived = archiveProjectDomain(source);
    await repository.save(archived);
    set((state) => ({
      projects: state.projects.map((project) => (project.id === id ? archived : project)),
    }));
  },

  unarchiveProject: async (id) => {
    const source = get().projects.find((project) => project.id === id);
    if (!source) return;
    const draft = unarchiveProjectDomain(source);
    await repository.save(draft);
    set((state) => ({
      projects: state.projects.map((project) => (project.id === id ? draft : project)),
    }));
  },

  trashProject: async (id) => {
    const source = get().projects.find((project) => project.id === id);
    if (!source) return;
    const trashed = trashProjectDomain(source);
    await repository.save(trashed);
    set((state) => ({
      projects: state.projects.map((project) => (project.id === id ? trashed : project)),
      trashUndo: source,
    }));
  },

  undoTrash: async () => {
    const undo = get().trashUndo;
    if (!undo) return;
    await repository.save(undo);
    set((state) => ({
      projects: state.projects.map((project) => (project.id === undo.id ? undo : project)),
      trashUndo: null,
    }));
  },

  dismissTrashUndo: () => set({ trashUndo: null }),

  restoreFromTrash: async (id) => {
    const source = get().projects.find((project) => project.id === id);
    if (!source) return;
    const restored = restoreProjectDomain(source);
    await repository.save(restored);
    set((state) => ({
      projects: state.projects.map((project) => (project.id === id ? restored : project)),
    }));
  },

  permanentlyDelete: async (id) => {
    await repository.deletePermanently(id);
    set((state) => ({ projects: state.projects.filter((project) => project.id !== id) }));
  },

  exportBackup: async () => {
    const payload = await repository.exportBackup();
    const userCatalogItems = await catalogRepository.listUser();
    const settings = useSettingsStore.getState().settings;
    downloadJson(`devflow-backup-${Date.now()}.json`, { ...payload, userCatalogItems, settings });
  },

  previewImport: (candidate) => {
    let migrated: unknown;
    try {
      migrated = migrateBackupPayloadProjects(candidate);
    } catch {
      return { ok: false, error: "invalid-shape" };
    }
    if (!isProjectBackupPayloadShape(migrated)) {
      return { ok: false, error: "invalid-shape" };
    }
    const diff = diffProjectImport(get().projects, migrated.projects);
    return { ok: true, preview: { payload: migrated, diff } };
  },

  /**
   * Settings are only applied when applySettings is explicitly true — import never auto-overwrites
   * current settings. Imported user catalog items are merged add-only into the catalog repository:
   * an id that already exists (system or user) is left untouched rather than overwritten, since no
   * acceptance criterion calls for a catalog-item conflict UI and silently overwriting an existing
   * user item would contradict "imports never silently replace existing data".
   */
  commitImport: async (preview, resolutions, applySettings) => {
    const { payload, diff } = preview;
    const conflictIds = new Set(diff.conflicts.map((conflict) => conflict.id));
    const resolvedConflicts = diff.conflicts.map((conflict) =>
      resolutions[conflict.id] === "imported" ? conflict.incoming : conflict.existing,
    );
    const untouched = get().projects.filter((project) => !conflictIds.has(project.id));
    const mergedProjects = [...untouched, ...resolvedConflicts, ...diff.newProjects];
    const mergedCandidate: ProjectBackupPayload = {
      backupVersion: payload.backupVersion,
      exportedAt: new Date().toISOString(),
      projects: mergedProjects,
      userCatalogItems: [],
      settings: payload.settings,
    };
    const result = await repository.importBackup(mergedCandidate);
    set({ projects: result.projects });

    if (payload.userCatalogItems.length > 0) {
      const [systemItems, existingUserItems] = await Promise.all([
        catalogRepository.listSystem(),
        catalogRepository.listUser(),
      ]);
      const existingIds = new Set([...systemItems, ...existingUserItems].map((item) => item.id));
      for (const item of payload.userCatalogItems) {
        if (!existingIds.has(item.id)) {
          await catalogRepository.saveUser(item);
        }
      }
    }

    if (applySettings && payload.settings) {
      await settingsRepository.save(payload.settings);
      useSettingsStore.setState({ settings: payload.settings });
    }
  },
}));

export function selectVisibleProjects(state: ProjectsState): Project[] {
  const query = state.searchQuery.trim().toLowerCase();
  const filtered = state.projects.filter((project) => {
    if (project.status === "trashed") return false;
    if (state.statusFilter === "draft" && project.status !== "draft") return false;
    if (state.statusFilter === "archived" && project.status !== "archived") return false;
    if (!query) return true;
    return (
      project.meta.name.toLowerCase().includes(query) ||
      project.brief.idea.toLowerCase().includes(query)
    );
  });
  return [...filtered].sort((a, b) => {
    if (state.sortBy === "name") {
      const nameCompare = a.meta.name.localeCompare(b.meta.name);
      return nameCompare !== 0 ? nameCompare : a.id.localeCompare(b.id);
    }
    const updatedCompare = b.updatedAt.localeCompare(a.updatedAt);
    return updatedCompare !== 0 ? updatedCompare : a.id.localeCompare(b.id);
  });
}

export function selectTrashedProjects(state: ProjectsState): Project[] {
  return [...state.projects]
    .filter((project) => project.status === "trashed")
    .sort((a, b) => {
      const trashedCompare = (b.trashedAt ?? "").localeCompare(a.trashedAt ?? "");
      return trashedCompare !== 0 ? trashedCompare : a.id.localeCompare(b.id);
    });
}
