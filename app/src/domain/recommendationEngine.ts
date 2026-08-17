import type { CatalogItem } from "@contracts/catalog";
import type { ExperienceProfile, Identifier, Locale, ProjectScale } from "@contracts/common";
import type {
  RecommendationEffect,
  RecommendationResult,
  RecommendationRule,
  RuleCondition,
  RuleConditionGroup,
  RuleOperator,
  ScoreContribution,
} from "@contracts/recommendation";

import { findSymmetricRelations } from "./catalog";

/**
 * Pure deterministic recommendation engine (FR-024/025, `RECOMMENDATION_AND_VALIDATION.md`
 * "Scoring"). No `Date.now()`, `Math.random`, network access, or object-insertion-order
 * dependence — the same canonical input always produces the same ordered output (AC-015).
 */

export interface RecommendationEngineConfiguration {
  domainIds: Identifier[];
  experienceProfile: ExperienceProfile;
  projectScale: ProjectScale;
  targetPlatforms: string[];
}

export interface RecommendationEngineInput {
  configuration: RecommendationEngineConfiguration;
  requirementTags: string[];
  acceptedItemIds: Identifier[];
  catalogItems: CatalogItem[];
  rules: RecommendationRule[];
  /** Selects which side of each `LocalizedText` becomes the stored `ScoreContribution.reason` string. */
  locale: Locale;
}

const RULE_OPERATORS: RuleOperator[] = [
  "equals",
  "not-equals",
  "includes",
  "includes-any",
  "includes-all",
  "greater-than-or-equal",
  "less-than-or-equal",
  "exists",
];

const RECOMMEND_THRESHOLD = 60;

/** Defensive runtime guard — a malformed rule (unknown operator/effect, wrong shape) is skipped rather than crashing the engine, matching the "malformed rule" fixture in `RECOMMENDATION_AND_VALIDATION.md`. V1 has no user-imported rule sets; this only protects against a corrupted bundled rule. */
export function isRecommendationRuleShape(value: unknown): value is RecommendationRule {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.schemaVersion !== "number" ||
    typeof candidate.priority !== "number" ||
    typeof candidate.enabled !== "boolean" ||
    typeof candidate.conditions !== "object" ||
    candidate.conditions === null ||
    !Array.isArray(candidate.effects)
  ) {
    return false;
  }
  return candidate.effects.every((effect) => {
    if (typeof effect !== "object" || effect === null) return false;
    const e = effect as Record<string, unknown>;
    return (
      typeof e.type === "string" &&
      ["recommend", "require", "avoid", "adjust-score", "add-question", "add-document"].includes(
        e.type,
      ) &&
      typeof e.targetId === "string" &&
      typeof e.reasonCode === "string"
    );
  });
}

function getFieldValue(input: unknown, field: string): unknown {
  let current: unknown = input;
  for (const part of field.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateCondition(condition: RuleCondition, input: unknown): boolean {
  if (!RULE_OPERATORS.includes(condition.operator)) return false;
  const value = getFieldValue(input, condition.field);
  switch (condition.operator) {
    case "exists":
      return value !== undefined && value !== null;
    case "equals":
      return value === condition.value;
    case "not-equals":
      return value !== condition.value;
    case "includes":
      if (Array.isArray(value))
        return condition.value !== undefined && value.includes(condition.value);
      if (typeof value === "string" && typeof condition.value === "string") {
        return value.includes(condition.value);
      }
      return false;
    case "includes-any":
      if (!Array.isArray(value) || !Array.isArray(condition.value)) return false;
      return condition.value.some((candidate) => value.includes(candidate));
    case "includes-all":
      if (!Array.isArray(value) || !Array.isArray(condition.value)) return false;
      return condition.value.every((candidate) => value.includes(candidate));
    case "greater-than-or-equal":
      return (
        typeof value === "number" && typeof condition.value === "number" && value >= condition.value
      );
    case "less-than-or-equal":
      return (
        typeof value === "number" && typeof condition.value === "number" && value <= condition.value
      );
    default:
      return false;
  }
}

function evaluateConditionGroup(group: RuleConditionGroup, input: unknown): boolean {
  if (group.all && !group.all.every((condition) => evaluateCondition(condition, input)))
    return false;
  if (
    group.any &&
    group.any.length > 0 &&
    !group.any.some((condition) => evaluateCondition(condition, input))
  ) {
    return false;
  }
  if (group.none && group.none.some((condition) => evaluateCondition(condition, input)))
    return false;
  return true;
}

interface EffectApplication {
  itemId: Identifier;
  contribution: ScoreContribution;
  forceRequired: boolean;
  forceAvoid: boolean;
}

function applyEffect(
  effect: RecommendationEffect,
  ruleId: Identifier,
  locale: Locale,
): EffectApplication | null {
  if (effect.type === "add-question" || effect.type === "add-document") {
    // No dynamic question/document pipeline exists in V1 (see module doc); nothing to score.
    return null;
  }
  const delta = effect.scoreDelta ?? 0;
  return {
    itemId: effect.targetId,
    contribution: {
      source: "rule",
      referenceId: ruleId,
      delta,
      reasonCode: effect.reasonCode,
      reason: effect.reason[locale],
    },
    forceRequired: effect.type === "require",
    forceAvoid: effect.type === "avoid",
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

export function runRecommendationEngine(input: RecommendationEngineInput): RecommendationResult[] {
  const validRules = input.rules
    .filter(isRecommendationRuleShape)
    .filter((rule) => rule.enabled)
    .sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority : a.id.localeCompare(b.id),
    );

  const conditionInput = {
    configuration: input.configuration,
    requirementTags: input.requirementTags,
    acceptedItemIds: input.acceptedItemIds,
  };

  const acceptedIds = new Set(input.acceptedItemIds);
  const itemsById = new Map(input.catalogItems.map((item) => [item.id, item]));

  const forcedRequired = new Map<Identifier, Identifier[]>();
  const forcedAvoid = new Map<Identifier, Identifier[]>();
  const contributionsByItem = new Map<Identifier, ScoreContribution[]>();
  const sourceRuleIdsByItem = new Map<Identifier, Set<Identifier>>();

  function addContribution(itemId: Identifier, contribution: ScoreContribution): void {
    const existing = contributionsByItem.get(itemId) ?? [];
    existing.push(contribution);
    contributionsByItem.set(itemId, existing);
  }

  // 1. Base score + bounded metadata contributions, per catalog item.
  for (const item of input.catalogItems) {
    addContribution(item.id, {
      source: "base",
      delta: item.recommendation.baseScore,
      reasonCode: "BASE_SCORE",
      reason: "Catalog base score",
    });

    if (item.recommendation.supportedProfiles.includes(input.configuration.experienceProfile)) {
      addContribution(item.id, {
        source: "metadata",
        delta: 5,
        reasonCode: "PROFILE_SUPPORTED",
        reason: "Supports the selected experience profile",
      });
    } else {
      addContribution(item.id, {
        source: "metadata",
        delta: -15,
        reasonCode: "PROFILE_NOT_SUPPORTED",
        reason: "Not intended for the selected experience profile",
      });
    }

    if (item.recommendation.supportedScales.includes(input.configuration.projectScale)) {
      addContribution(item.id, {
        source: "metadata",
        delta: 5,
        reasonCode: "SCALE_SUPPORTED",
        reason: "Supports the selected project scale",
      });
    } else {
      addContribution(item.id, {
        source: "metadata",
        delta: -10,
        reasonCode: "SCALE_NOT_SUPPORTED",
        reason: "Not intended for the selected project scale",
      });
    }

    const domainOverlap = item.domainIds.some((id) => input.configuration.domainIds.includes(id));
    if (domainOverlap) {
      addContribution(item.id, {
        source: "metadata",
        delta: 10,
        reasonCode: "DOMAIN_MATCH",
        reason: "Applies to a selected domain",
      });
    }

    const preferredDomainOverlap = item.recommendation.preferredDomainIds.some((id) =>
      input.configuration.domainIds.includes(id),
    );
    if (preferredDomainOverlap) {
      addContribution(item.id, {
        source: "metadata",
        delta: 10,
        reasonCode: "PREFERRED_DOMAIN_MATCH",
        reason: "Preferred for a selected domain",
      });
    }

    if (input.configuration.targetPlatforms.length > 0) {
      const platformOverlap = item.supportedPlatforms.some((platform) =>
        input.configuration.targetPlatforms.includes(platform),
      );
      if (platformOverlap) {
        addContribution(item.id, {
          source: "metadata",
          delta: 5,
          reasonCode: "PLATFORM_MATCH",
          reason: "Supports a selected target platform",
        });
      }
    }

    const matchedTagCount = item.recommendation.requirementTags.filter((tag) =>
      input.requirementTags.includes(tag),
    ).length;
    if (matchedTagCount > 0) {
      addContribution(item.id, {
        source: "metadata",
        delta: Math.min(16, matchedTagCount * 8),
        reasonCode: "REQUIREMENT_TAG_MATCH",
        reason: "Matches a project requirement tag",
      });
    }

    // Dependency/conflict contributions from the item's own declared relations.
    for (const relation of item.relations) {
      if (relation.type === "requires" && !acceptedIds.has(relation.targetId)) {
        addContribution(item.id, {
          source: "dependency",
          referenceId: relation.targetId,
          delta: relation.severity === "error" ? -20 : -5,
          reasonCode: "MISSING_DEPENDENCY",
          reason: relation.reason[input.locale],
        });
      }
    }

    for (const relation of findSymmetricRelations(item.id, input.catalogItems, "conflicts-with")) {
      if (acceptedIds.has(relation.targetId)) {
        addContribution(item.id, {
          source: "conflict",
          referenceId: relation.targetId,
          delta: relation.severity === "error" ? -50 : -15,
          reasonCode: "CONFLICTS_WITH_ACCEPTED",
          reason: relation.reason[input.locale],
        });
        if (relation.severity === "error") {
          forcedAvoid.set(item.id, [...(forcedAvoid.get(item.id) ?? []), relation.targetId]);
        }
      }
    }

    if (item.maturity === "deprecated") {
      addContribution(item.id, {
        source: "metadata",
        delta: -100,
        reasonCode: "DEPRECATED_ITEM",
        reason: "This item is deprecated in the catalog",
      });
      forcedAvoid.set(item.id, forcedAvoid.get(item.id) ?? []);
    }
  }

  // 2. Declarative rule effects, in priority/id order.
  for (const rule of validRules) {
    if (!evaluateConditionGroup(rule.conditions, conditionInput)) continue;
    for (const effect of rule.effects) {
      const application = applyEffect(effect, rule.id, input.locale);
      if (!application || !itemsById.has(application.itemId)) continue;
      addContribution(application.itemId, application.contribution);
      const ruleIds = sourceRuleIdsByItem.get(application.itemId) ?? new Set<Identifier>();
      ruleIds.add(rule.id);
      sourceRuleIdsByItem.set(application.itemId, ruleIds);
      if (application.forceRequired) {
        forcedRequired.set(application.itemId, [
          ...(forcedRequired.get(application.itemId) ?? []),
          rule.id,
        ]);
      }
      if (application.forceAvoid) {
        forcedAvoid.set(application.itemId, [
          ...(forcedAvoid.get(application.itemId) ?? []),
          rule.id,
        ]);
      }
    }
  }

  // 3. Fold contributions into a score/classification per item that has at least a base contribution.
  const results: RecommendationResult[] = [];
  for (const item of input.catalogItems) {
    const contributions = contributionsByItem.get(item.id) ?? [];
    const rawScore = contributions.reduce((sum, contribution) => sum + contribution.delta, 0);
    const score = clampScore(rawScore);

    const missingDependencyIds = contributions
      .filter((c) => c.reasonCode === "MISSING_DEPENDENCY" && c.referenceId)
      .map((c) => c.referenceId as Identifier);
    const conflictItemIds = contributions
      .filter((c) => c.reasonCode === "CONFLICTS_WITH_ACCEPTED" && c.referenceId)
      .map((c) => c.referenceId as Identifier);

    const isForcedAvoid = forcedAvoid.has(item.id);
    const isForcedRequired = forcedRequired.has(item.id) && !isForcedAvoid;

    const classification: RecommendationResult["classification"] = isForcedAvoid
      ? "avoid"
      : isForcedRequired
        ? "required"
        : score >= RECOMMEND_THRESHOLD
          ? "recommended"
          : "alternative";

    results.push({
      itemId: item.id,
      score,
      rank: 0,
      classification,
      contributions,
      missingDependencyIds,
      conflictItemIds,
      sourceRuleIds: [...(sourceRuleIdsByItem.get(item.id) ?? [])].sort((a, b) =>
        a.localeCompare(b),
      ),
    });
  }

  // 4. Stable sort (required -> recommended -> alternative -> avoid, score desc, name, id) then rank.
  const classificationOrder: Record<RecommendationResult["classification"], number> = {
    required: 0,
    recommended: 1,
    alternative: 2,
    avoid: 3,
  };
  results.sort((a, b) => {
    const classCompare =
      classificationOrder[a.classification] - classificationOrder[b.classification];
    if (classCompare !== 0) return classCompare;
    if (a.score !== b.score) return b.score - a.score;
    const nameA = itemsById.get(a.itemId)?.name ?? a.itemId;
    const nameB = itemsById.get(b.itemId)?.name ?? b.itemId;
    const nameCompare = nameA.localeCompare(nameB);
    return nameCompare !== 0 ? nameCompare : a.itemId.localeCompare(b.itemId);
  });

  return results.map((result, index) => ({ ...result, rank: index + 1 }));
}
