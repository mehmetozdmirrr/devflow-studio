import type { Project } from "@contracts/project";
import type { CatalogItem } from "@contracts/catalog";
import type { UserSettings } from "@contracts/settings";
import type { ProjectBackupPayload } from "@contracts/storage";

import { isProjectListShape } from "./project";
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  PROJECT_MIGRATIONS,
  applyMigrations,
} from "./projectMigrations";

/** Duplicated minimal shape check (not imported from adapters/) to keep this domain module free of adapter dependencies. */
function isUserSettingsShape(value: unknown): value is UserSettings {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return "schemaVersion" in candidate && "uiLanguage" in candidate && "theme" in candidate;
}

export const PROJECT_BACKUP_VERSION = 1;

function hasProjectsArrayShape(
  value: unknown,
): value is Record<string, unknown> & { projects: unknown[] } {
  if (typeof value !== "object" || value === null) return false;
  return Array.isArray((value as Record<string, unknown>).projects);
}

/**
 * Runs pending schema migrations over an imported backup's projects before strict shape
 * validation, so an older backup (e.g. a Phase 2 export missing `customDomainLabels`) is
 * migrated rather than wrongly rejected as malformed. Mixed-version project lists are
 * supported: the oldest `schemaVersion` present is used as the migration start point.
 */
export function migrateBackupPayloadProjects(candidate: unknown): unknown {
  if (!hasProjectsArrayShape(candidate)) return candidate;
  const versions = candidate.projects.map((project) => {
    const schemaVersion =
      typeof project === "object" && project !== null
        ? (project as Record<string, unknown>).schemaVersion
        : undefined;
    return typeof schemaVersion === "number" ? schemaVersion : 1;
  });
  const fromVersion = versions.length > 0 ? Math.min(...versions) : CURRENT_PROJECT_SCHEMA_VERSION;
  if (fromVersion >= CURRENT_PROJECT_SCHEMA_VERSION) return candidate;
  const migrated = applyMigrations(
    candidate.projects,
    fromVersion,
    CURRENT_PROJECT_SCHEMA_VERSION,
    PROJECT_MIGRATIONS,
  );
  return { ...candidate, projects: migrated.value };
}

export function buildBackupPayload(
  projects: Project[],
  userCatalogItems: CatalogItem[],
  settings?: UserSettings,
  now: string = new Date().toISOString(),
): ProjectBackupPayload {
  return {
    backupVersion: PROJECT_BACKUP_VERSION,
    exportedAt: now,
    projects,
    userCatalogItems,
    settings,
  };
}

export function isProjectBackupPayloadShape(value: unknown): value is ProjectBackupPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.backupVersion !== PROJECT_BACKUP_VERSION ||
    typeof candidate.exportedAt !== "string" ||
    !isProjectListShape(candidate.projects) ||
    !Array.isArray(candidate.userCatalogItems)
  ) {
    return false;
  }
  return candidate.settings === undefined || isUserSettingsShape(candidate.settings);
}

export interface ProjectImportConflict {
  id: string;
  existing: Project;
  incoming: Project;
}

export interface ProjectImportDiff {
  newProjects: Project[];
  conflicts: ProjectImportConflict[];
}

/** Pure diff, writes nothing — the caller decides how to resolve conflicts before committing. */
export function diffProjectImport(current: Project[], incoming: Project[]): ProjectImportDiff {
  const currentById = new Map(current.map((project) => [project.id, project]));
  const newProjects: Project[] = [];
  const conflicts: ProjectImportConflict[] = [];
  for (const incomingProject of incoming) {
    const existing = currentById.get(incomingProject.id);
    if (existing) {
      conflicts.push({ id: incomingProject.id, existing, incoming: incomingProject });
    } else {
      newProjects.push(incomingProject);
    }
  }
  return { newProjects, conflicts };
}
