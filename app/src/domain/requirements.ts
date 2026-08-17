import type { Requirement, RequirementPriority, RequirementType } from "@contracts/requirement";

export const REQUIREMENT_TITLE_MAX_LENGTH = 200;
export const REQUIREMENT_DESCRIPTION_MAX_LENGTH = 2000;

export interface RequirementInput {
  type: RequirementType;
  title: string;
  description: string;
  priority: RequirementPriority;
  tags?: string[];
}

export interface RequirementFieldErrors {
  title?: "required" | "tooLong";
  description?: "required" | "tooLong";
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function validateRequirementInput(input: RequirementInput): RequirementFieldErrors {
  const errors: RequirementFieldErrors = {};
  if (isBlank(input.title)) errors.title = "required";
  else if (input.title.length > REQUIREMENT_TITLE_MAX_LENGTH) errors.title = "tooLong";
  if (isBlank(input.description)) errors.description = "required";
  else if (input.description.length > REQUIREMENT_DESCRIPTION_MAX_LENGTH)
    errors.description = "tooLong";
  return errors;
}

export function hasRequirementFieldErrors(errors: RequirementFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

function generateRequirementId(): string {
  return `requirement-${crypto.randomUUID()}`;
}

export function createRequirement(
  input: RequirementInput,
  now: string = new Date().toISOString(),
): Requirement {
  return {
    id: generateRequirementId(),
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    priority: input.priority,
    status: "draft",
    source: "user",
    tags: input.tags ?? [],
    acceptanceCriteria: [],
    verificationMethods: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function addRequirement(
  requirements: Requirement[],
  input: RequirementInput,
  now?: string,
): Requirement[] {
  return [...requirements, createRequirement(input, now)];
}

export function updateRequirement(
  requirements: Requirement[],
  id: string,
  patch: Partial<RequirementInput>,
  now: string = new Date().toISOString(),
): Requirement[] {
  return requirements.map((requirement) => {
    if (requirement.id !== id) return requirement;
    return {
      ...requirement,
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      updatedAt: now,
    };
  });
}

export function removeRequirement(requirements: Requirement[], id: string): Requirement[] {
  return requirements.filter((requirement) => requirement.id !== id);
}

export function reprioritizeRequirement(
  requirements: Requirement[],
  id: string,
  priority: RequirementPriority,
  now?: string,
): Requirement[] {
  return updateRequirement(requirements, id, { priority }, now);
}

const PRIORITY_ORDER: RequirementPriority[] = ["must", "should", "could", "wont"];

export function sortRequirementsByPriority(requirements: Requirement[]): Requirement[] {
  return [...requirements].sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority),
  );
}

export function requirementsByType(
  requirements: Requirement[],
  type: RequirementType,
): Requirement[] {
  return requirements.filter((requirement) => requirement.type === type);
}
