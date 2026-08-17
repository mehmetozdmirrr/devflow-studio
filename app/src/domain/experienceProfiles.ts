import type { ExecutionProfile, ExperienceProfile, SelectionMode } from "@contracts/common";

export type ExplanationDepth = "high" | "medium" | "low";

export interface ExperienceProfileRules {
  id: ExperienceProfile;
  explanationDepth: ExplanationDepth;
  advancedControlsDefault: boolean;
  defaultSelectionMode: SelectionMode;
  defaultExecutionProfile: ExecutionProfile;
  defaultAgentLimit: number;
  defaultSkillLimit: number;
}

/** Mirrors catalog/seed/experience-profiles.json (schemaVersion 1) — the app does not load catalog seed JSON at runtime yet, so this is kept manually in sync (FR-009). */
export const EXPERIENCE_PROFILE_RULES: Record<ExperienceProfile, ExperienceProfileRules> = {
  beginner: {
    id: "beginner",
    explanationDepth: "high",
    advancedControlsDefault: false,
    defaultSelectionMode: "guided",
    defaultExecutionProfile: "economic",
    defaultAgentLimit: 3,
    defaultSkillLimit: 8,
  },
  intermediate: {
    id: "intermediate",
    explanationDepth: "medium",
    advancedControlsDefault: false,
    defaultSelectionMode: "guided",
    defaultExecutionProfile: "balanced",
    defaultAgentLimit: 5,
    defaultSkillLimit: 14,
  },
  advanced: {
    id: "advanced",
    explanationDepth: "low",
    advancedControlsDefault: true,
    defaultSelectionMode: "manual",
    defaultExecutionProfile: "balanced",
    defaultAgentLimit: 7,
    defaultSkillLimit: 20,
  },
  team: {
    id: "team",
    explanationDepth: "medium",
    advancedControlsDefault: true,
    defaultSelectionMode: "guided",
    defaultExecutionProfile: "comprehensive",
    defaultAgentLimit: 12,
    defaultSkillLimit: 25,
  },
};

export const EXPERIENCE_PROFILE_IDS: ExperienceProfile[] = [
  "beginner",
  "intermediate",
  "advanced",
  "team",
];

export function getExperienceProfileRules(profile: ExperienceProfile): ExperienceProfileRules {
  return EXPERIENCE_PROFILE_RULES[profile];
}

/**
 * Applies the new profile's selection/execution defaults only when the current values still
 * equal the *previous* profile's defaults (i.e. the user never diverged from them). A user's
 * explicit, confirmed choice is never silently overwritten by a later profile change (AC-007).
 */
export function reconcileProfileDefaults<
  C extends { selectionMode: SelectionMode; executionProfile: ExecutionProfile },
>(configuration: C, previousProfile: ExperienceProfile, nextProfile: ExperienceProfile): C {
  if (previousProfile === nextProfile) return configuration;
  const previousRules = getExperienceProfileRules(previousProfile);
  const nextRules = getExperienceProfileRules(nextProfile);
  const selectionMode =
    configuration.selectionMode === previousRules.defaultSelectionMode
      ? nextRules.defaultSelectionMode
      : configuration.selectionMode;
  const executionProfile =
    configuration.executionProfile === previousRules.defaultExecutionProfile
      ? nextRules.defaultExecutionProfile
      : configuration.executionProfile;
  if (
    selectionMode === configuration.selectionMode &&
    executionProfile === configuration.executionProfile
  ) {
    return configuration;
  }
  return { ...configuration, selectionMode, executionProfile };
}
