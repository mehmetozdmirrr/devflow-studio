import type { Identifier, LocalizedText } from "./common";
export type RuleOperator = "equals" | "not-equals" | "includes" | "includes-any" | "includes-all" | "greater-than-or-equal" | "less-than-or-equal" | "exists";
export interface RuleCondition {
    field: string;
    operator: RuleOperator;
    value?: string | number | boolean | string[];
}
export interface RuleConditionGroup {
    all?: RuleCondition[];
    any?: RuleCondition[];
    none?: RuleCondition[];
}
export type RecommendationEffectType = "recommend" | "require" | "avoid" | "adjust-score" | "add-question" | "add-document";
export interface RecommendationEffect {
    type: RecommendationEffectType;
    targetId: Identifier;
    scoreDelta?: number;
    reasonCode: string;
    reason: LocalizedText;
}
export interface RecommendationRule {
    id: Identifier;
    schemaVersion: number;
    ruleVersion: string;
    priority: number;
    enabled: boolean;
    conditions: RuleConditionGroup;
    effects: RecommendationEffect[];
}
export interface ScoreContribution {
    source: "base" | "metadata" | "rule" | "dependency" | "conflict";
    referenceId?: Identifier;
    delta: number;
    reasonCode: string;
    reason: string;
}
export interface RecommendationResult {
    itemId: Identifier;
    score: number;
    rank: number;
    classification: "required" | "recommended" | "alternative" | "avoid";
    contributions: ScoreContribution[];
    missingDependencyIds: Identifier[];
    conflictItemIds: Identifier[];
    sourceRuleIds: Identifier[];
}
export interface RecommendationRun {
    engineVersion: string;
    catalogVersion: string;
    ruleSetVersion: string;
    inputFingerprint: string;
    results: RecommendationResult[];
}
