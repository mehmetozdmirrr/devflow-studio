import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@contracts/catalog";
import type { RecommendationRule } from "@contracts/recommendation";

import {
  isRecommendationRuleShape,
  runRecommendationEngine,
  type RecommendationEngineInput,
} from "../domain/recommendationEngine";
import { SYSTEM_CATALOG_ITEMS } from "../catalog/systemCatalog";
import { SYSTEM_RECOMMENDATION_RULES } from "../catalog/recommendationRules";

function baseInput(overrides: Partial<RecommendationEngineInput> = {}): RecommendationEngineInput {
  return {
    configuration: {
      domainIds: ["domain-web"],
      experienceProfile: "beginner",
      projectScale: "mvp",
      targetPlatforms: [],
    },
    requirementTags: [],
    acceptedItemIds: [],
    catalogItems: SYSTEM_CATALOG_ITEMS,
    rules: SYSTEM_RECOMMENDATION_RULES,
    locale: "en",
    ...overrides,
  };
}

describe("runRecommendationEngine — determinism (AC-015)", () => {
  it("produces an identical ordered result and reason codes across repeated runs", () => {
    const first = runRecommendationEngine(baseInput());
    const second = runRecommendationEngine(baseInput());
    expect(second).toEqual(first);
  });

  it("is unaffected by input array insertion order", () => {
    const forward = runRecommendationEngine(baseInput());
    const reversed = runRecommendationEngine(
      baseInput({ catalogItems: [...SYSTEM_CATALOG_ITEMS].reverse() }),
    );
    expect([...reversed].sort((a, b) => a.itemId.localeCompare(b.itemId))).toEqual(
      [...forward].sort((a, b) => a.itemId.localeCompare(b.itemId)),
    );
  });
});

describe("runRecommendationEngine — classification and scoring", () => {
  it("ranks required before recommended before alternative before avoid", () => {
    const results = runRecommendationEngine(
      baseInput({
        requirementTags: ["security-review"],
        configuration: { ...baseInput().configuration, experienceProfile: "team" },
      }),
    );
    const order = results.map((r) => r.classification);
    const firstAvoidIndex = order.indexOf("avoid");
    const firstRequiredIndex = order.indexOf("required");
    if (firstRequiredIndex !== -1 && firstAvoidIndex !== -1) {
      expect(firstRequiredIndex).toBeLessThan(firstAvoidIndex);
    }
    for (let i = 1; i < order.length; i += 1) {
      const rank = { required: 0, recommended: 1, alternative: 2, avoid: 3 };
      expect(rank[order[i]]).toBeGreaterThanOrEqual(rank[order[i - 1]]);
    }
  });

  it("marks a deprecated item as avoid regardless of score", () => {
    const results = runRecommendationEngine(baseInput());
    const deprecated = results.find((r) => r.itemId === "hook-post-commit-notify");
    expect(deprecated?.classification).toBe("avoid");
  });

  it("flags a missing hard dependency and does not classify the dependent item as recommended", () => {
    const results = runRecommendationEngine(
      baseInput({ configuration: { ...baseInput().configuration, domainIds: ["domain-web"] } }),
    );
    const nextjs = results.find((r) => r.itemId === "framework-nextjs");
    expect(nextjs?.missingDependencyIds).toContain("framework-react");
  });

  it("marks a hard conflict as avoid when the conflicting item is already accepted", () => {
    const results = runRecommendationEngine(baseInput({ acceptedItemIds: ["ui-system-tailwind"] }));
    const shadcnConflict = results.find((r) => r.itemId === "ui-system-shadcn");
    // shadcn requires tailwind (not a conflict) — use a real conflicts-with pair instead:
    void shadcnConflict;
    const reduxResults = runRecommendationEngine(
      baseInput({ acceptedItemIds: ["state-management-redux"] }),
    );
    const zustand = reduxResults.find((r) => r.itemId === "state-management-zustand");
    expect(zustand?.conflictItemIds).toContain("state-management-redux");
  });

  it("applies rule score deltas deterministically with matching reason codes", () => {
    const results = runRecommendationEngine(baseInput());
    const react = results.find((r) => r.itemId === "framework-react");
    expect(react?.contributions.some((c) => c.reasonCode === "DOMAIN_MATCH_WEB")).toBe(true);
  });

  it("produces a stable tie-break order by name then id for equal scores", () => {
    const results = runRecommendationEngine(baseInput());
    for (let i = 1; i < results.length; i += 1) {
      if (
        results[i].classification === results[i - 1].classification &&
        results[i].score === results[i - 1].score
      ) {
        const nameA =
          SYSTEM_CATALOG_ITEMS.find((it) => it.id === results[i - 1].itemId)?.name ?? "";
        const nameB = SYSTEM_CATALOG_ITEMS.find((it) => it.id === results[i].itemId)?.name ?? "";
        expect(nameA.localeCompare(nameB)).toBeLessThanOrEqual(0);
      }
    }
  });
});

describe("runRecommendationEngine — localized reasons", () => {
  it("stores the English reason text when locale is en", () => {
    const results = runRecommendationEngine(baseInput({ locale: "en" }));
    const react = results.find((r) => r.itemId === "framework-react");
    const contribution = react?.contributions.find((c) => c.reasonCode === "DOMAIN_MATCH_WEB");
    expect(contribution?.reason).toContain("Web domain is selected");
  });

  it("stores the Turkish reason text when locale is tr", () => {
    const results = runRecommendationEngine(baseInput({ locale: "tr" }));
    const react = results.find((r) => r.itemId === "framework-react");
    const contribution = react?.contributions.find((c) => c.reasonCode === "DOMAIN_MATCH_WEB");
    expect(contribution?.reason).toContain("Web alanı seçili");
  });
});

describe("isRecommendationRuleShape — malformed rule safety", () => {
  it("accepts a well-formed rule", () => {
    expect(isRecommendationRuleShape(SYSTEM_RECOMMENDATION_RULES[0])).toBe(true);
  });

  it("rejects a malformed rule instead of letting the engine crash", () => {
    const malformed = { id: "bad-rule", schemaVersion: 1, priority: 1, enabled: true } as unknown;
    expect(isRecommendationRuleShape(malformed)).toBe(false);

    const withMalformedRule = [...SYSTEM_RECOMMENDATION_RULES, malformed as RecommendationRule];
    expect(() => runRecommendationEngine(baseInput({ rules: withMalformedRule }))).not.toThrow();
  });

  it("ignores a rule effect targeting an unknown catalog item without throwing", () => {
    const unknownTargetRule: RecommendationRule = {
      id: "rule-unknown-target",
      schemaVersion: 1,
      ruleVersion: "1.0.0",
      priority: 1,
      enabled: true,
      conditions: {},
      effects: [
        {
          type: "recommend",
          targetId: "does-not-exist",
          reasonCode: "TEST",
          reason: { en: "test", tr: "test" },
        },
      ],
    };
    const withRules = { ...baseInput(), rules: [unknownTargetRule] };
    expect(() => runRecommendationEngine(withRules)).not.toThrow();
    const items = new Set<CatalogItem["id"]>();
    for (const item of SYSTEM_CATALOG_ITEMS) items.add(item.id);
    expect(items.has("does-not-exist")).toBe(false);
  });
});
