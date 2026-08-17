import type {
  Project,
  ProjectBrief,
  ProjectConfiguration,
  ProjectMeta,
  ProjectStatus,
} from "@contracts/project";
import type { ExperienceProfile, Locale } from "@contracts/common";
import type { PackageSettings } from "@contracts/package";
import type { ProjectValidation } from "@contracts/validation";
import type { UserSettings } from "@contracts/settings";

import { evaluateWizardCompleteness, type WizardStepId } from "./wizardSteps";

export const PROJECT_SCHEMA_VERSION = 2;
export const PROJECT_NAME_MAX_LENGTH = 160;
export const PROJECT_BRIEF_FIELD_MAX_LENGTH = 4000;

const PROJECT_STATUSES: ProjectStatus[] = [
  "draft",
  "configured",
  "validated",
  "generated",
  "archived",
  "trashed",
];

export interface CreateProjectInput {
  name: string;
  idea: string;
  problem: string;
  proposedSolution: string;
  experienceProfile: ExperienceProfile;
}

export interface ProjectFieldErrors {
  name?: "required" | "tooLong";
  idea?: "required" | "tooLong";
  problem?: "required" | "tooLong";
  proposedSolution?: "required" | "tooLong";
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function validateProjectName(name: string): "required" | "tooLong" | undefined {
  if (isBlank(name)) return "required";
  if (name.length > PROJECT_NAME_MAX_LENGTH) return "tooLong";
  return undefined;
}

export function validateBriefField(value: string): "required" | "tooLong" | undefined {
  if (isBlank(value)) return "required";
  if (value.length > PROJECT_BRIEF_FIELD_MAX_LENGTH) return "tooLong";
  return undefined;
}

export function validateCreateProjectInput(input: CreateProjectInput): ProjectFieldErrors {
  const errors: ProjectFieldErrors = {};
  const nameError = validateProjectName(input.name);
  if (nameError) errors.name = nameError;
  const ideaError = validateBriefField(input.idea);
  if (ideaError) errors.idea = ideaError;
  const problemError = validateBriefField(input.problem);
  if (problemError) errors.problem = problemError;
  const solutionError = validateBriefField(input.proposedSolution);
  if (solutionError) errors.proposedSolution = solutionError;
  return errors;
}

export function hasFieldErrors(errors: ProjectFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "project";
}

function generateProjectId(): string {
  return `project-${crypto.randomUUID()}`;
}

export function defaultPackageSettings(outputLanguage: Locale): PackageSettings {
  return {
    outputLanguage,
    includeClaudeMd: true,
    includeProjectConfig: true,
    includeAgents: true,
    includeSkills: true,
    includeDocuments: true,
    includeTaskFiles: true,
    includeSafeSettings: true,
    includeHooks: true,
    includeMcpRecommendations: true,
    excludedOptionalPaths: [],
    textOverrides: {},
  };
}

export function defaultProjectValidation(): ProjectValidation {
  return {
    validatorVersion: "unvalidated",
    issues: [],
    isValid: false,
    canExport: false,
  };
}

export function defaultProjectConfiguration(
  settings: UserSettings,
  experienceProfile: ExperienceProfile,
): ProjectConfiguration {
  return {
    experienceProfile,
    projectScale: "mvp",
    selectionMode: settings.defaultSelectionMode,
    executionProfile: settings.defaultExecutionProfile,
    uiLanguage: settings.uiLanguage,
    outputLanguage: settings.defaultOutputLanguage,
    domainIds: [],
    customDomainIds: [],
    customDomainLabels: {},
    targetPlatforms: [],
    connectivity: "online",
    userModel: "single-user",
    dataSensitivity: [],
    enabledCapabilities: [],
    forbiddenTechnologies: [],
  };
}

export function createDraftProject(
  input: CreateProjectInput,
  settings: UserSettings,
  now: string = new Date().toISOString(),
): Project {
  const meta: ProjectMeta = {
    name: input.name.trim(),
    slug: slugify(input.name),
    tags: [],
  };
  const brief: ProjectBrief = {
    idea: input.idea.trim(),
    problem: input.problem.trim(),
    proposedSolution: input.proposedSolution.trim(),
    targetUsers: [],
    goals: [],
    successMeasures: [],
    constraints: [],
  };
  return {
    id: generateProjectId(),
    schemaVersion: PROJECT_SCHEMA_VERSION,
    revision: 0,
    meta,
    brief,
    configuration: defaultProjectConfiguration(settings, input.experienceProfile),
    requirements: [],
    selections: [],
    packageSettings: defaultPackageSettings(settings.defaultOutputLanguage),
    validation: defaultProjectValidation(),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneProject(source: Project, now: string = new Date().toISOString()): Project {
  return {
    ...source,
    id: generateProjectId(),
    schemaVersion: PROJECT_SCHEMA_VERSION,
    revision: 0,
    meta: {
      ...source.meta,
      name: `${source.meta.name} (copy)`,
      slug: slugify(`${source.meta.name}-copy`),
      tags: [...source.meta.tags],
    },
    brief: {
      ...source.brief,
      targetUsers: [...source.brief.targetUsers],
      goals: [...source.brief.goals],
      successMeasures: [...source.brief.successMeasures],
      constraints: [...source.brief.constraints],
    },
    configuration: {
      ...source.configuration,
      domainIds: [...source.configuration.domainIds],
      customDomainIds: [...source.configuration.customDomainIds],
      customDomainLabels: { ...source.configuration.customDomainLabels },
      targetPlatforms: [...source.configuration.targetPlatforms],
      dataSensitivity: [...source.configuration.dataSensitivity],
      enabledCapabilities: [...source.configuration.enabledCapabilities],
      forbiddenTechnologies: [...source.configuration.forbiddenTechnologies],
    },
    requirements: [...source.requirements],
    selections: source.selections.map((selection) => ({ ...selection })),
    packageSettings: {
      ...source.packageSettings,
      excludedOptionalPaths: [...source.packageSettings.excludedOptionalPaths],
      textOverrides: { ...source.packageSettings.textOverrides },
    },
    validation: { ...source.validation, issues: [...source.validation.issues] },
    status: "draft",
    archivedAt: undefined,
    trashedAt: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function archiveProject(project: Project, now: string = new Date().toISOString()): Project {
  return {
    ...project,
    status: "archived",
    archivedAt: now,
    updatedAt: now,
    revision: project.revision + 1,
  };
}

export function unarchiveProject(
  project: Project,
  now: string = new Date().toISOString(),
): Project {
  return {
    ...project,
    status: "draft",
    archivedAt: undefined,
    updatedAt: now,
    revision: project.revision + 1,
  };
}

/** Preserves archivedAt so restore can distinguish "was archived" from "was draft" (no contract change needed). */
export function trashProject(project: Project, now: string = new Date().toISOString()): Project {
  return {
    ...project,
    status: "trashed",
    trashedAt: now,
    updatedAt: now,
    revision: project.revision + 1,
  };
}

export interface ConfigureProjectResult {
  ok: boolean;
  project: Project;
  incompleteStepIds?: WizardStepId[];
}

/** Marks a project "configured" only when the wizard's own completeness check (FR-015) passes; otherwise returns the project unchanged plus the incomplete step ids, never a silent status change. */
export function configureProject(
  project: Project,
  now: string = new Date().toISOString(),
): ConfigureProjectResult {
  const completeness = evaluateWizardCompleteness(project);
  if (!completeness.readyToConfigure) {
    return { ok: false, project, incompleteStepIds: completeness.incompleteStepIds };
  }
  return {
    ok: true,
    project: { ...project, status: "configured", updatedAt: now, revision: project.revision + 1 },
  };
}

export function restoreProject(project: Project, now: string = new Date().toISOString()): Project {
  const status: ProjectStatus = project.archivedAt ? "archived" : "draft";
  return {
    ...project,
    status,
    trashedAt: undefined,
    updatedAt: now,
    revision: project.revision + 1,
  };
}

function isProjectMetaShape(value: unknown): value is ProjectMeta {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.slug === "string" &&
    Array.isArray(candidate.tags)
  );
}

function isProjectBriefShape(value: unknown): value is ProjectBrief {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.idea === "string" &&
    typeof candidate.problem === "string" &&
    typeof candidate.proposedSolution === "string" &&
    Array.isArray(candidate.targetUsers) &&
    Array.isArray(candidate.goals) &&
    Array.isArray(candidate.successMeasures) &&
    Array.isArray(candidate.constraints)
  );
}

function isProjectConfigurationShape(value: unknown): value is ProjectConfiguration {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.experienceProfile === "string" &&
    typeof candidate.projectScale === "string" &&
    typeof candidate.selectionMode === "string" &&
    typeof candidate.executionProfile === "string" &&
    typeof candidate.uiLanguage === "string" &&
    typeof candidate.outputLanguage === "string" &&
    Array.isArray(candidate.domainIds) &&
    Array.isArray(candidate.customDomainIds) &&
    typeof candidate.customDomainLabels === "object" &&
    candidate.customDomainLabels !== null &&
    !Array.isArray(candidate.customDomainLabels)
  );
}

export function isProjectShape(value: unknown): value is Project {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.schemaVersion === "number" &&
    typeof candidate.revision === "number" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.status === "string" &&
    PROJECT_STATUSES.includes(candidate.status as ProjectStatus) &&
    isProjectMetaShape(candidate.meta) &&
    isProjectBriefShape(candidate.brief) &&
    isProjectConfigurationShape(candidate.configuration) &&
    Array.isArray(candidate.requirements) &&
    Array.isArray(candidate.selections) &&
    typeof candidate.packageSettings === "object" &&
    candidate.packageSettings !== null &&
    typeof candidate.validation === "object" &&
    candidate.validation !== null
  );
}

export function isProjectListShape(value: unknown): value is Project[] {
  return Array.isArray(value) && value.every(isProjectShape);
}
