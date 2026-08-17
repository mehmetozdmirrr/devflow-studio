import { create } from "zustand";
import type { CatalogItem } from "@contracts/catalog";
import type { Identifier, Locale } from "@contracts/common";
import type { Project } from "@contracts/project";
import type { RecommendationResult, RecommendationRule } from "@contracts/recommendation";
import type { ProjectValidation } from "@contracts/validation";

import {
  acceptCatalogSelection,
  addCustomSelection,
  removeCatalogSelection,
  replaceCatalogSelection,
  type CustomSelectionInput,
} from "../domain/selections";
import { acknowledgeValidationIssue, runValidationEngine } from "../domain/validationEngine";
import { runRecommendationEngine } from "../domain/recommendationEngine";
import { selectAllCatalogItems, useCatalogStore } from "./catalogStore";
import { useProjectsStore } from "./projectsStore";

export const VALIDATOR_VERSION = "1.0.0";

/** Every distinct tag across the project's requirements — used by recommendation rule conditions and metadata scoring. */
function aggregateRequirementTags(project: Project): string[] {
  const tags = new Set<string>();
  for (const requirement of project.requirements) {
    for (const tag of requirement.tags) tags.add(tag);
  }
  return [...tags];
}

function acceptedItemIds(project: Project): Identifier[] {
  return project.selections
    .filter((selection) => selection.decision === "accepted" && selection.itemId !== undefined)
    .map((selection) => selection.itemId as Identifier);
}

/** Pure composition of `domain/recommendationEngine.ts` from a project + catalog snapshot — no persisted `RecommendationRun`; V1 recomputes on every view (`Project` has no field to store one). */
export function computeRecommendations(
  project: Project,
  catalogItems: CatalogItem[],
  rules: RecommendationRule[],
  locale: Locale,
): RecommendationResult[] {
  return runRecommendationEngine({
    configuration: {
      domainIds: [...project.configuration.domainIds, ...project.configuration.customDomainIds],
      experienceProfile: project.configuration.experienceProfile,
      projectScale: project.configuration.projectScale,
      targetPlatforms: project.configuration.targetPlatforms,
    },
    requirementTags: aggregateRequirementTags(project),
    acceptedItemIds: acceptedItemIds(project),
    catalogItems,
    rules,
    locale,
  });
}

/**
 * Recomputes validation live, then carries forward any previously acknowledged `override` from
 * `project.validation` onto the freshly computed issues (matched by `id`, which is stable across
 * recomputes for the same underlying issue per `buildIssueId`). Without this, every fresh
 * recompute — which every caller does on every render/action, since no `ValidationRun` is
 * persisted — silently drops prior acknowledgments: the UI would keep showing an unacknowledged
 * issue and re-offer the Acknowledge control even though `acknowledgeIssue` had already recorded
 * one, because it was never actually read back.
 */
export function computeValidation(
  project: Project,
  catalogItems: CatalogItem[],
): ProjectValidation {
  const fresh = runValidationEngine({
    selections: project.selections,
    catalogItems,
    targetPlatforms: project.configuration.targetPlatforms,
    validatorVersion: VALIDATOR_VERSION,
  });
  const priorOverrides = new Map(
    project.validation.issues
      .filter((issue) => issue.override)
      .map((issue) => [issue.id, issue.override]),
  );
  if (priorOverrides.size === 0) return fresh;
  return {
    ...fresh,
    issues: fresh.issues.map((issue) => {
      const override = priorOverrides.get(issue.id);
      return override ? { ...issue, override } : issue;
    }),
  };
}

interface RecommendationsState {
  acceptItem: (
    projectId: Identifier,
    item: CatalogItem,
    source: "deterministic" | "manual" | "ai",
  ) => Promise<void>;
  removeItem: (projectId: Identifier, item: CatalogItem) => Promise<void>;
  replaceItem: (projectId: Identifier, oldItem: CatalogItem, newItem: CatalogItem) => Promise<void>;
  addCustomItem: (projectId: Identifier, input: CustomSelectionInput) => Promise<void>;
  acknowledgeIssue: (projectId: Identifier, issueId: Identifier, reason: string) => Promise<void>;
}

/** Every action reads the current project/catalog from their own stores, computes new selections + revalidates against them, then persists through `projectsStore` — the only place `project.selections`/`project.validation` are ever written, and always in response to one explicit call. */
async function persistSelections(
  projectId: Identifier,
  selections: Project["selections"],
): Promise<void> {
  const catalogItems = selectAllCatalogItems(useCatalogStore.getState());
  const projectsApi = useProjectsStore.getState();
  const project = projectsApi.projects.find((candidate) => candidate.id === projectId);
  if (!project) return;
  const validation = computeValidation({ ...project, selections }, catalogItems);
  projectsApi.updateProjectDraft(projectId, { selections, validation });
  await useProjectsStore.getState().saveProjectNow(projectId);
}

export const useRecommendationsStore = create<RecommendationsState>(() => ({
  acceptItem: async (projectId, item, source) => {
    const project = useProjectsStore
      .getState()
      .projects.find((candidate) => candidate.id === projectId);
    if (!project) return;
    const selections = acceptCatalogSelection(project.selections, projectId, item, source);
    await persistSelections(projectId, selections);
  },

  removeItem: async (projectId, item) => {
    const project = useProjectsStore
      .getState()
      .projects.find((candidate) => candidate.id === projectId);
    if (!project) return;
    const selections = removeCatalogSelection(project.selections, projectId, item, "deterministic");
    await persistSelections(projectId, selections);
  },

  replaceItem: async (projectId, oldItem, newItem) => {
    const project = useProjectsStore
      .getState()
      .projects.find((candidate) => candidate.id === projectId);
    if (!project) return;
    const selections = replaceCatalogSelection(project.selections, projectId, oldItem, newItem);
    await persistSelections(projectId, selections);
  },

  addCustomItem: async (projectId, input) => {
    const project = useProjectsStore
      .getState()
      .projects.find((candidate) => candidate.id === projectId);
    if (!project) return;
    const selections = addCustomSelection(project.selections, projectId, input);
    await persistSelections(projectId, selections);
  },

  acknowledgeIssue: async (projectId, issueId, reason) => {
    const project = useProjectsStore
      .getState()
      .projects.find((candidate) => candidate.id === projectId);
    if (!project) return;
    // `project.validation` is only a persisted snapshot from the last explicit save; recompute
    // live first (same as the step's display) so the issue id being acknowledged actually exists.
    const catalogItems = selectAllCatalogItems(useCatalogStore.getState());
    const liveValidation = computeValidation(project, catalogItems);
    const validation = acknowledgeValidationIssue(liveValidation, issueId, reason, "current-user");
    useProjectsStore.getState().updateProjectDraft(projectId, { validation });
    await useProjectsStore.getState().saveProjectNow(projectId);
  },
}));
