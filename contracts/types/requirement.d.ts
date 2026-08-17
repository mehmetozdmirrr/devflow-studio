import type { AuditTimestamps, Identifier } from "./common";
export type RequirementType = "functional" | "non-functional" | "constraint";
export type RequirementPriority = "must" | "should" | "could" | "wont";
export type RequirementStatus = "draft" | "approved" | "rejected" | "deferred";
export type RequirementSource = "user" | "external-guideline" | "deterministic-rule" | "ai-accepted";
export interface AcceptanceCriterion {
    id: Identifier;
    given: string;
    when: string;
    then: string;
    negativeOrBoundary?: string;
}
export interface Requirement extends AuditTimestamps {
    id: Identifier;
    type: RequirementType;
    title: string;
    description: string;
    priority: RequirementPriority;
    status: RequirementStatus;
    source: RequirementSource;
    sourceReferenceId?: Identifier;
    tags: string[];
    acceptanceCriteria: AcceptanceCriterion[];
    verificationMethods: Array<"unit" | "component" | "integration" | "contract" | "e2e" | "manual">;
}
