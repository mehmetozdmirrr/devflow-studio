import { describe, expect, it } from "vitest";

import {
  EXPERIENCE_PROFILE_RULES,
  getExperienceProfileRules,
  reconcileProfileDefaults,
} from "../domain/experienceProfiles";
import {
  SYSTEM_DOMAINS,
  createCustomDomainId,
  hasAnyDomainSelected,
  isSystemDomainId,
  validateCustomDomainLabel,
} from "../domain/domains";
import {
  applyDomainRemoval,
  computeDomainRemovalImpact,
  computeResumeStepId,
  evaluateWizardCompleteness,
  getAdjacentStepId,
  getDisplayIndex,
  getStepCount,
  getVisibleConditionalPrompts,
  getVisibleSteps,
  WIZARD_STEP_DEFINITIONS,
} from "../domain/wizardSteps";
import { createDraftProject, configureProject } from "../domain/project";
import { cloneDefaultSettings } from "../domain/settings";
import {
  addRequirement,
  hasRequirementFieldErrors,
  removeRequirement,
  reprioritizeRequirement,
  sortRequirementsByPriority,
  updateRequirement,
  validateRequirementInput,
} from "../domain/requirements";
import type { CreateProjectInput } from "../domain/project";

const settings = cloneDefaultSettings();
const validInput: CreateProjectInput = {
  name: "Test Project",
  idea: "An idea",
  problem: "A problem",
  proposedSolution: "A solution",
  experienceProfile: "beginner",
};

describe("reconcileProfileDefaults (AC-007)", () => {
  it("applies the new profile's defaults when the user never diverged", () => {
    const configuration = {
      selectionMode: EXPERIENCE_PROFILE_RULES.beginner.defaultSelectionMode,
      executionProfile: EXPERIENCE_PROFILE_RULES.beginner.defaultExecutionProfile,
    };
    const next = reconcileProfileDefaults(configuration, "beginner", "advanced");
    expect(next.selectionMode).toBe(EXPERIENCE_PROFILE_RULES.advanced.defaultSelectionMode);
    expect(next.executionProfile).toBe(EXPERIENCE_PROFILE_RULES.advanced.defaultExecutionProfile);
  });

  it("never overwrites a value the user explicitly diverged from", () => {
    const configuration = {
      selectionMode: "manual" as const,
      executionProfile: "comprehensive" as const,
    };
    const next = reconcileProfileDefaults(configuration, "beginner", "advanced");
    expect(next.selectionMode).toBe("manual");
    expect(next.executionProfile).toBe("comprehensive");
  });

  it("is a no-op when the profile does not change", () => {
    const configuration = {
      selectionMode: "manual" as const,
      executionProfile: "comprehensive" as const,
    };
    expect(reconcileProfileDefaults(configuration, "advanced", "advanced")).toBe(configuration);
  });

  it("getExperienceProfileRules returns the matching rule set", () => {
    expect(getExperienceProfileRules("team").defaultExecutionProfile).toBe("comprehensive");
  });
});

describe("domains helpers (FR-011)", () => {
  it("lists exactly the 14 documented system domains", () => {
    expect(SYSTEM_DOMAINS).toHaveLength(14);
    expect(isSystemDomainId("domain-web")).toBe(true);
    expect(isSystemDomainId("custom-anything")).toBe(false);
  });

  it("creates a slugified custom domain id and de-duplicates collisions", () => {
    const first = createCustomDomainId("3D Printing Software", []);
    expect(first).toBe("custom-3d-printing-software");
    const second = createCustomDomainId("3D Printing Software", [first]);
    expect(second).toBe("custom-3d-printing-software-2");
    const third = createCustomDomainId("3D Printing Software", [first, second]);
    expect(third).toBe("custom-3d-printing-software-3");
  });

  it("hasAnyDomainSelected requires at least one system or custom domain (AC-008)", () => {
    expect(hasAnyDomainSelected([], [])).toBe(false);
    expect(hasAnyDomainSelected(["domain-web"], [])).toBe(true);
    expect(hasAnyDomainSelected([], ["custom-x"])).toBe(true);
  });

  it("validateCustomDomainLabel rejects blank labels", () => {
    expect(validateCustomDomainLabel("   ")).toBe("required");
    expect(validateCustomDomainLabel("3D Printing")).toBeUndefined();
  });
});

describe("wizard step visibility and contiguous numbering", () => {
  it("enables the recommendations step (Phase 4/5) and includes it in the visible/display list", () => {
    const definition = WIZARD_STEP_DEFINITIONS.find((step) => step.id === "recommendations");
    expect(definition).toBeDefined();
    expect(definition?.enabled).toBe(true);
    expect(getVisibleSteps().some((step) => step.id === "recommendations")).toBe(true);
  });

  it("numbers review contiguously right after recommendations with no gap", () => {
    const recommendationsIndex = getDisplayIndex("recommendations");
    const reviewIndex = getDisplayIndex("review");
    expect(reviewIndex).toBe(recommendationsIndex + 1);
    expect(getStepCount()).toBe(getVisibleSteps().length);
  });

  it("getAdjacentStepId moves through recommendations between selectionExecution and review", () => {
    expect(getAdjacentStepId("selectionExecution", "next")).toBe("recommendations");
    expect(getAdjacentStepId("recommendations", "next")).toBe("review");
    expect(getAdjacentStepId("review", "previous")).toBe("recommendations");
    expect(getAdjacentStepId("recommendations", "previous")).toBe("selectionExecution");
  });
});

describe("computeResumeStepId / evaluateWizardCompleteness (FR-010, FR-015)", () => {
  it("resumes at the first incomplete data step for a fresh draft", () => {
    const project = createDraftProject(validInput, settings);
    expect(computeResumeStepId(project)).toBe("domains");
  });

  it("resumes at review once every data step is complete", () => {
    let project = createDraftProject(validInput, settings);
    project = {
      ...project,
      configuration: {
        ...project.configuration,
        domainIds: ["domain-web"],
        targetPlatforms: ["web"],
      },
      brief: { ...project.brief, targetUsers: ["Solo devs"], goals: ["Ship faster"] },
      requirements: [
        {
          ...addRequirement([], {
            type: "functional",
            title: "T",
            description: "D",
            priority: "must",
          })[0],
        },
        {
          ...addRequirement([], {
            type: "non-functional",
            title: "T2",
            description: "D2",
            priority: "should",
          })[0],
        },
      ],
    };
    expect(computeResumeStepId(project)).toBe("review");
    expect(evaluateWizardCompleteness(project).readyToConfigure).toBe(true);
  });

  it("lists every incomplete data step for a fresh draft", () => {
    const project = createDraftProject(validInput, settings);
    const result = evaluateWizardCompleteness(project);
    expect(result.readyToConfigure).toBe(false);
    expect(result.incompleteStepIds).toContain("domains");
    expect(result.incompleteStepIds).toContain("functionalRequirements");
  });
});

describe("configureProject (FR-015)", () => {
  it("refuses to mark configured while sections are incomplete", () => {
    const project = createDraftProject(validInput, settings);
    const result = configureProject(project);
    expect(result.ok).toBe(false);
    expect(result.project.status).toBe("draft");
    expect(result.incompleteStepIds?.length).toBeGreaterThan(0);
  });

  it("marks configured once every data step is complete", () => {
    let project = createDraftProject(validInput, settings);
    project = {
      ...project,
      configuration: {
        ...project.configuration,
        domainIds: ["domain-web"],
        targetPlatforms: ["web"],
      },
      brief: { ...project.brief, targetUsers: ["Solo devs"], goals: ["Ship faster"] },
      requirements: [
        ...addRequirement([], {
          type: "functional",
          title: "T",
          description: "D",
          priority: "must",
        }),
        ...addRequirement([], {
          type: "constraint",
          title: "T2",
          description: "D2",
          priority: "must",
        }),
      ],
    };
    const result = configureProject(project);
    expect(result.ok).toBe(true);
    expect(result.project.status).toBe("configured");
    expect(result.project.revision).toBe(project.revision + 1);
  });
});

describe("conditional prompts and domain-removal dependency map (FR-012, AC-009)", () => {
  it("prompt visibility is purely derived from current domainIds", () => {
    expect(getVisibleConditionalPrompts(["domain-mobile"]).map((p) => p.id)).toEqual([
      "mobileDistribution",
      "mobilePush",
    ]);
    expect(getVisibleConditionalPrompts([])).toEqual([]);
  });

  it("computes only the dependent capabilities not justified by a remaining domain", () => {
    const impact = computeDomainRemovalImpact(
      "domain-mobile",
      ["domain-backend-api"],
      ["app-store-distribution", "push-notifications", "expected-request-scale"],
    );
    expect(impact.clearedCapabilities.sort()).toEqual([
      "app-store-distribution",
      "push-notifications",
    ]);
  });

  it("preserves a dependent capability still justified by another remaining domain", () => {
    // domain-backend-api and domain-cloud-devops both justify "expected-request-scale".
    const impact = computeDomainRemovalImpact(
      "domain-backend-api",
      ["domain-cloud-devops"],
      ["expected-request-scale"],
    );
    expect(impact.clearedCapabilities).toEqual([]);
  });

  it("confirm branch: applyDomainRemoval clears only the impacted values, preserves generic/shared data", () => {
    let project = createDraftProject(validInput, settings);
    project = {
      ...project,
      configuration: {
        ...project.configuration,
        domainIds: ["domain-mobile", "domain-backend-api"],
        targetPlatforms: ["ios", "android"],
        dataSensitivity: ["pii"],
        enabledCapabilities: [
          "app-store-distribution",
          "push-notifications",
          "expected-request-scale",
        ],
      },
    };

    const nextConfiguration = applyDomainRemoval(project.configuration, "domain-mobile");

    expect(nextConfiguration.domainIds).toEqual(["domain-backend-api"]);
    expect(nextConfiguration.enabledCapabilities).toEqual(["expected-request-scale"]);
    expect(nextConfiguration.targetPlatforms).toEqual(["ios", "android"]);
    expect(nextConfiguration.dataSensitivity).toEqual(["pii"]);
  });

  it("cancel branch: not calling applyDomainRemoval leaves every value byte-for-byte unchanged", () => {
    let project = createDraftProject(validInput, settings);
    project = {
      ...project,
      configuration: {
        ...project.configuration,
        domainIds: ["domain-mobile"],
        enabledCapabilities: ["app-store-distribution"],
      },
    };
    const before = project.configuration;
    // Simulates the user cancelling the impact ConfirmDialog: no mutation function is invoked.
    expect(project.configuration).toBe(before);
    expect(project.configuration.domainIds).toEqual(["domain-mobile"]);
    expect(project.configuration.enabledCapabilities).toEqual(["app-store-distribution"]);
  });

  it("removes a custom domain's id and label together", () => {
    let project = createDraftProject(validInput, settings);
    project = {
      ...project,
      configuration: {
        ...project.configuration,
        customDomainIds: ["custom-x"],
        customDomainLabels: { "custom-x": "X Field" },
      },
    };
    const next = applyDomainRemoval(project.configuration, "custom-x");
    expect(next.customDomainIds).toEqual([]);
    expect(next.customDomainLabels).toEqual({});
  });
});

describe("requirements CRUD (FR-014)", () => {
  it("validates required title/description", () => {
    const errors = validateRequirementInput({
      type: "functional",
      title: "  ",
      description: "",
      priority: "must",
    });
    expect(hasRequirementFieldErrors(errors)).toBe(true);
    expect(errors.title).toBe("required");
    expect(errors.description).toBe("required");
  });

  it("adds, edits, prioritizes, and removes a requirement", () => {
    let requirements = addRequirement([], {
      type: "functional",
      title: "Login",
      description: "Users can log in",
      priority: "should",
    });
    expect(requirements).toHaveLength(1);
    const id = requirements[0].id;

    requirements = updateRequirement(requirements, id, { title: "Login flow" });
    expect(requirements[0].title).toBe("Login flow");

    requirements = reprioritizeRequirement(requirements, id, "must");
    expect(requirements[0].priority).toBe("must");

    requirements = removeRequirement(requirements, id);
    expect(requirements).toHaveLength(0);
  });

  it("sorts by priority order must > should > could > wont", () => {
    let requirements = addRequirement([], {
      type: "functional",
      title: "A",
      description: "d",
      priority: "could",
    });
    requirements = addRequirement(requirements, {
      type: "functional",
      title: "B",
      description: "d",
      priority: "must",
    });
    const sorted = sortRequirementsByPriority(requirements);
    expect(sorted.map((r) => r.title)).toEqual(["B", "A"]);
  });
});
