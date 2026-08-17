import type { Project } from "@contracts/project";
import type { ProjectBackupPayload, StorageEnvelope } from "@contracts/storage";

import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  PROJECT_MIGRATIONS,
  applyMigrations,
} from "../domain/projectMigrations";
import { isProjectListShape } from "../domain/project";
import { buildBackupPayload, isProjectBackupPayloadShape } from "../domain/projectBackup";
import type { ProjectRepository } from "../ports/projectRepository";
import { DEVFLOW_NAMESPACE_PREFIX } from "./localStorageSettingsAdapter";
import { sha256Hex } from "./hash";

export const PROJECTS_STORAGE_KEY = `${DEVFLOW_NAMESPACE_PREFIX}projects`;
export const PROJECTS_LKG_STORAGE_KEY = `${DEVFLOW_NAMESPACE_PREFIX}projects:lkg`;
export const PROJECTS_STAGED_STORAGE_KEY = `${DEVFLOW_NAMESPACE_PREFIX}projects:staged`;
/** Warn well before typical browser localStorage limits (~5-10MB/origin); staged-write briefly holds ~2x this at once. */
export const PROJECTS_STORAGE_SOFT_QUOTA_BYTES = 1 * 1024 * 1024;
const APPLICATION_VERSION = "phase-2";

export class ProjectStorageCorruptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectStorageCorruptionError";
  }
}

export class ProjectImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectImportValidationError";
  }
}

export interface ProjectWriteOutcome {
  projects: Project[];
  quotaWarning: boolean;
}

interface RawEnvelopeShape {
  schemaVersion: number;
  applicationVersion: string;
  writtenAt: string;
  checksum: string;
  payload: unknown;
}

function isEnvelopeShape(value: unknown): value is RawEnvelopeShape {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.schemaVersion === "number" &&
    typeof candidate.applicationVersion === "string" &&
    typeof candidate.writtenAt === "string" &&
    typeof candidate.checksum === "string" &&
    "payload" in candidate
  );
}

const computeChecksum = sha256Hex;

function estimateByteSize(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Shared by normal reads and staged-write readback: parse -> checksum -> migrate -> shape-validate. */
async function loadValidatedList(raw: string): Promise<Project[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ProjectStorageCorruptionError("stored envelope is not valid JSON");
  }
  if (!isEnvelopeShape(parsed)) {
    throw new ProjectStorageCorruptionError("stored envelope has an invalid shape");
  }
  const checksum = await computeChecksum(parsed.payload);
  if (checksum !== parsed.checksum) {
    throw new ProjectStorageCorruptionError("stored envelope failed checksum validation");
  }
  const migrationResult = applyMigrations(
    parsed.payload,
    parsed.schemaVersion,
    CURRENT_PROJECT_SCHEMA_VERSION,
    PROJECT_MIGRATIONS,
  );
  const payload = migrationResult.value;
  if (!isProjectListShape(payload)) {
    throw new ProjectStorageCorruptionError("migrated payload has an invalid project list shape");
  }
  return payload;
}

export class LocalStorageProjectAdapter implements ProjectRepository {
  async list(): Promise<Project[]> {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    try {
      return await loadValidatedList(raw);
    } catch {
      const lkgRaw = window.localStorage.getItem(PROJECTS_LKG_STORAGE_KEY);
      if (!lkgRaw) {
        throw new ProjectStorageCorruptionError(
          "current project storage and last-known-good are both unreadable",
        );
      }
      return await loadValidatedList(lkgRaw);
    }
  }

  async get(id: string): Promise<Project | null> {
    const projects = await this.list();
    return projects.find((project) => project.id === id) ?? null;
  }

  async save(project: Project): Promise<Project> {
    const projects = await this.list();
    const index = projects.findIndex((existing) => existing.id === project.id);
    const next =
      index === -1
        ? [...projects, project]
        : projects.map((existing, position) => (position === index ? project : existing));
    await this.writeList(next);
    return project;
  }

  async deletePermanently(id: string): Promise<void> {
    const projects = await this.list();
    const next = projects.filter((project) => project.id !== id);
    await this.writeList(next);
  }

  async exportBackup(): Promise<ProjectBackupPayload> {
    const projects = await this.list();
    return buildBackupPayload(projects, []);
  }

  /** Candidate is expected to already be the fully resolved list (application layer resolves conflicts first). */
  async importBackup(candidate: unknown): Promise<ProjectBackupPayload> {
    if (!isProjectBackupPayloadShape(candidate)) {
      throw new ProjectImportValidationError("malformed or unsupported backup payload");
    }
    await this.writeList(candidate.projects);
    return candidate;
  }

  /** Staged-write protocol: validate -> stage -> readback+validate -> promote -> cleanup. */
  async writeList(projects: Project[]): Promise<ProjectWriteOutcome> {
    if (!isProjectListShape(projects)) {
      throw new ProjectStorageCorruptionError("candidate project list failed shape validation");
    }
    const checksum = await computeChecksum(projects);
    const envelope: StorageEnvelope<Project[]> = {
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      applicationVersion: APPLICATION_VERSION,
      writtenAt: new Date().toISOString(),
      checksum,
      payload: projects,
    };
    const serialized = JSON.stringify(envelope);
    const quotaWarning = estimateByteSize(serialized) > PROJECTS_STORAGE_SOFT_QUOTA_BYTES;

    try {
      window.localStorage.setItem(PROJECTS_STAGED_STORAGE_KEY, serialized);
      const stagedRaw = window.localStorage.getItem(PROJECTS_STAGED_STORAGE_KEY);
      if (!stagedRaw) {
        throw new ProjectStorageCorruptionError("staged write did not persist");
      }
      const validated = await loadValidatedList(stagedRaw);
      if (validated.length !== projects.length) {
        throw new ProjectStorageCorruptionError("staged readback did not match the candidate list");
      }
      const existingCurrent = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (existingCurrent) {
        window.localStorage.setItem(PROJECTS_LKG_STORAGE_KEY, existingCurrent);
      }
      window.localStorage.setItem(PROJECTS_STORAGE_KEY, stagedRaw);
    } finally {
      window.localStorage.removeItem(PROJECTS_STAGED_STORAGE_KEY);
    }
    return { projects, quotaWarning };
  }
}
