import type { Identifier } from "@contracts/common";
import type { Project, ProjectConfiguration } from "@contracts/project";

export type WizardStepId =
  | "identity"
  | "profile"
  | "domains"
  | "platformsScope"
  | "functionalRequirements"
  | "dataIntegrations"
  | "qualitySecurity"
  | "selectionExecution"
  | "recommendations"
  | "review";

export interface WizardStepDefinition {
  id: WizardStepId;
  enabled: boolean;
}

/**
 * Stable step order/id list. `recommendations` kept a real, disabled slot through Phase 3 (DEC-022)
 * so the Phase 4 catalog / Phase 5 recommendation engine could flip its `enabled` to `true` without
 * an id reshuffle or dangling link once built — now enabled. `getVisibleSteps`/`getDisplayIndex`
 * compute contiguous 1-based numbers from only the enabled steps, so V1 users never see a gap.
 */
export const WIZARD_STEP_DEFINITIONS: WizardStepDefinition[] = [
  { id: "identity", enabled: true },
  { id: "profile", enabled: true },
  { id: "domains", enabled: true },
  { id: "platformsScope", enabled: true },
  { id: "functionalRequirements", enabled: true },
  { id: "dataIntegrations", enabled: true },
  { id: "qualitySecurity", enabled: true },
  { id: "selectionExecution", enabled: true },
  { id: "recommendations", enabled: true },
  { id: "review", enabled: true },
];

export const WIZARD_STEP_LABEL_KEYS: Record<WizardStepId, string> = {
  identity: "wizard.steps.identity",
  profile: "wizard.steps.profile",
  domains: "wizard.steps.domains",
  platformsScope: "wizard.steps.platformsScope",
  functionalRequirements: "wizard.steps.functionalRequirements",
  dataIntegrations: "wizard.steps.dataIntegrations",
  qualitySecurity: "wizard.steps.qualitySecurity",
  selectionExecution: "wizard.steps.selectionExecution",
  recommendations: "wizard.steps.recommendations",
  review: "wizard.steps.review",
};

export function getVisibleSteps(): WizardStepDefinition[] {
  return WIZARD_STEP_DEFINITIONS.filter((step) => step.enabled);
}

export function getDisplayIndex(stepId: WizardStepId): number {
  const index = getVisibleSteps().findIndex((step) => step.id === stepId);
  return index === -1 ? -1 : index + 1;
}

export function getStepCount(): number {
  return getVisibleSteps().length;
}

export function getAdjacentStepId(
  stepId: WizardStepId,
  direction: "next" | "previous",
): WizardStepId | null {
  const visible = getVisibleSteps();
  const index = visible.findIndex((step) => step.id === stepId);
  if (index === -1) return null;
  const targetIndex = direction === "next" ? index + 1 : index - 1;
  return visible[targetIndex]?.id ?? null;
}

function isIdentityFilled(project: Project): boolean {
  return (
    project.meta.name.trim().length > 0 &&
    project.brief.idea.trim().length > 0 &&
    project.brief.problem.trim().length > 0 &&
    project.brief.proposedSolution.trim().length > 0
  );
}

function isDomainsFilled(project: Project): boolean {
  return (
    project.configuration.domainIds.length > 0 || project.configuration.customDomainIds.length > 0
  );
}

function isPlatformsScopeFilled(project: Project): boolean {
  return project.configuration.targetPlatforms.length > 0;
}

function isFunctionalRequirementsFilled(project: Project): boolean {
  return project.requirements.some((requirement) => requirement.type === "functional");
}

function isDataIntegrationsFilled(project: Project): boolean {
  return project.brief.targetUsers.length > 0 && project.brief.goals.length > 0;
}

function isQualitySecurityFilled(project: Project): boolean {
  return project.requirements.some(
    (requirement) => requirement.type === "non-functional" || requirement.type === "constraint",
  );
}

/** Steps without an entry here (e.g. `selectionExecution`) always have a valid value via defaults, so they are always considered complete. */
export const WIZARD_STEP_COMPLETION_CHECKS: Partial<
  Record<WizardStepId, (project: Project) => boolean>
> = {
  identity: isIdentityFilled,
  domains: isDomainsFilled,
  platformsScope: isPlatformsScopeFilled,
  functionalRequirements: isFunctionalRequirementsFilled,
  dataIntegrations: isDataIntegrationsFilled,
  qualitySecurity: isQualitySecurityFilled,
};

export function isStepComplete(stepId: WizardStepId, project: Project): boolean {
  const check = WIZARD_STEP_COMPLETION_CHECKS[stepId];
  return check ? check(project) : true;
}

/** Furthest incomplete data-capturing step, or `review` once every data step is complete. Pure — no persisted "current step" pointer is needed to resume a draft. */
export function computeResumeStepId(project: Project): WizardStepId {
  const dataSteps = getVisibleSteps().filter((step) => step.id !== "review");
  const firstIncomplete = dataSteps.find((step) => !isStepComplete(step.id, project));
  return firstIncomplete?.id ?? "review";
}

export interface WizardCompletenessResult {
  stepStatus: Partial<Record<WizardStepId, boolean>>;
  incompleteStepIds: WizardStepId[];
  readyToConfigure: boolean;
}

export function evaluateWizardCompleteness(project: Project): WizardCompletenessResult {
  const dataSteps = getVisibleSteps().filter((step) => step.id !== "review");
  const stepStatus: Partial<Record<WizardStepId, boolean>> = {};
  const incompleteStepIds: WizardStepId[] = [];
  for (const step of dataSteps) {
    const complete = isStepComplete(step.id, project);
    stepStatus[step.id] = complete;
    if (!complete) incompleteStepIds.push(step.id);
  }
  return { stepStatus, incompleteStepIds, readyToConfigure: incompleteStepIds.length === 0 };
}

export type ConditionalPromptId =
  | "mobileDistribution"
  | "mobilePush"
  | "backendRequestScale"
  | "cloudRequestScale"
  | "gameEngineIntegration";

export interface ConditionalPrompt {
  id: ConditionalPromptId;
  domainId: Identifier;
  capabilityValue: string;
}

/**
 * Declarative FR-012 rule set: which domain reveals which prompt, and which `enabledCapabilities`
 * tag value that prompt toggles. Visibility (`getVisibleConditionalPrompts`) is always derived
 * live from the current domain selection — it never mutates stored data by itself.
 */
export const CONDITIONAL_PROMPTS: ConditionalPrompt[] = [
  {
    id: "mobileDistribution",
    domainId: "domain-mobile",
    capabilityValue: "app-store-distribution",
  },
  { id: "mobilePush", domainId: "domain-mobile", capabilityValue: "push-notifications" },
  {
    id: "backendRequestScale",
    domainId: "domain-backend-api",
    capabilityValue: "expected-request-scale",
  },
  {
    id: "cloudRequestScale",
    domainId: "domain-cloud-devops",
    capabilityValue: "expected-request-scale",
  },
  { id: "gameEngineIntegration", domainId: "domain-game", capabilityValue: "engine-integration" },
];

export function getVisibleConditionalPrompts(domainIds: Identifier[]): ConditionalPrompt[] {
  return CONDITIONAL_PROMPTS.filter((prompt) => domainIds.includes(prompt.domainId));
}

/** Domain -> the specific capability values that only make sense while that domain is selected. Used only to compute domain-removal impact, never to drive prompt visibility. */
export const DOMAIN_DEPENDENT_CAPABILITIES: Record<Identifier, string[]> =
  CONDITIONAL_PROMPTS.reduce<Record<Identifier, string[]>>((map, prompt) => {
    map[prompt.domainId] = [...(map[prompt.domainId] ?? []), prompt.capabilityValue];
    return map;
  }, {});

export interface DomainRemovalImpact {
  domainId: Identifier;
  clearedCapabilities: string[];
}

/**
 * Values in `enabledCapabilities` that would be cleared if `domainId` were removed, given the
 * domains that would remain selected. A value still justified by another remaining domain is
 * never included, so shared answers are preserved (AC-009).
 */
export function computeDomainRemovalImpact(
  domainId: Identifier,
  remainingDomainIds: Identifier[],
  enabledCapabilities: string[],
): DomainRemovalImpact {
  const dependent = DOMAIN_DEPENDENT_CAPABILITIES[domainId] ?? [];
  const stillJustified = new Set(
    remainingDomainIds.flatMap((id) => DOMAIN_DEPENDENT_CAPABILITIES[id] ?? []),
  );
  const clearedCapabilities = dependent.filter(
    (value) => enabledCapabilities.includes(value) && !stillJustified.has(value),
  );
  return { domainId, clearedCapabilities };
}

/**
 * Applies one explicit, user-confirmed domain removal: drops the domain (system or custom) and
 * clears exactly the capability values `computeDomainRemovalImpact` identified as dependent and
 * no longer justified. Every other field (`targetPlatforms`, `dataSensitivity`, brief fields,
 * any capability not in the dependency map) is left untouched. Never call this without the
 * caller having shown the computed impact and received explicit confirmation first.
 */
export function applyDomainRemoval(
  configuration: ProjectConfiguration,
  domainId: Identifier,
): ProjectConfiguration {
  const domainIds = configuration.domainIds.filter((id) => id !== domainId);
  const customDomainIds = configuration.customDomainIds.filter((id) => id !== domainId);
  const customDomainLabels = { ...configuration.customDomainLabels };
  delete customDomainLabels[domainId];

  const remainingDomainIds = [...domainIds, ...customDomainIds];
  const impact = computeDomainRemovalImpact(
    domainId,
    remainingDomainIds,
    configuration.enabledCapabilities,
  );
  const enabledCapabilities = configuration.enabledCapabilities.filter(
    (value) => !impact.clearedCapabilities.includes(value),
  );

  return { ...configuration, domainIds, customDomainIds, customDomainLabels, enabledCapabilities };
}
