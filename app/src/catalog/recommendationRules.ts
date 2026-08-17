import type { RecommendationRule } from "@contracts/recommendation";
import type { LocalizedText } from "@contracts/common";

/**
 * Versioned V1 system recommendation rule set (FR-024, RECOMMENDATION_AND_VALIDATION.md
 * "Declarative rule safety"): only the enumerated `RuleOperator`/`RecommendationEffectType`
 * fields from `contracts/types/recommendation.ts` are used — no `eval`, no dynamic property
 * execution, no imported regex. `add-question`/`add-document` effect types are intentionally
 * unused this phase: V1 has no dynamic question/document pipeline for the engine to drive, and a
 * rule using an effect nothing consumes would be fake behavior, not a real capability.
 *
 * Rules are applied in `priority` ascending, then `id` ascending (RECOMMENDATION_AND_VALIDATION.md
 * "Scoring" step 3) by `recommendationEngine.ts`.
 */
export const RECOMMENDATION_RULE_SET_VERSION = "1.0.0";

function loc(en: string, tr: string): LocalizedText {
  return { en, tr };
}

export const SYSTEM_RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    id: "rule-web-domain-recommend-react",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 10,
    enabled: true,
    conditions: {
      all: [{ field: "configuration.domainIds", operator: "includes", value: "domain-web" }],
    },
    effects: [
      {
        type: "recommend",
        targetId: "framework-react",
        scoreDelta: 15,
        reasonCode: "DOMAIN_MATCH_WEB",
        reason: loc(
          "Web domain is selected; React is the catalog's default UI framework.",
          "Web alanı seçili; React katalogdaki varsayılan arayüz çatısıdır.",
        ),
      },
    ],
  },
  {
    id: "rule-web-beginner-tailwind",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 20,
    enabled: true,
    conditions: {
      all: [
        { field: "configuration.domainIds", operator: "includes", value: "domain-web" },
        {
          field: "configuration.experienceProfile",
          operator: "includes-any",
          value: ["beginner", "intermediate"],
        },
      ],
    },
    effects: [
      {
        type: "recommend",
        targetId: "ui-system-tailwind",
        scoreDelta: 10,
        reasonCode: "BEGINNER_FRIENDLY_STYLING",
        reason: loc(
          "Utility-first CSS avoids a separate design-system setup step for less experienced profiles.",
          "Yardımcı sınıf öncelikli CSS, deneyimsiz profiller için ayrı bir tasarım sistemi kurulum adımını ortadan kaldırır.",
        ),
      },
    ],
  },
  {
    id: "rule-backend-domain-recommend-express",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 30,
    enabled: true,
    conditions: {
      all: [
        { field: "configuration.domainIds", operator: "includes", value: "domain-backend-api" },
      ],
    },
    effects: [
      {
        type: "recommend",
        targetId: "framework-express",
        scoreDelta: 15,
        reasonCode: "DOMAIN_MATCH_BACKEND",
        reason: loc(
          "Backend/API domain is selected; Express is a simple default HTTP framework.",
          "Backend/API alanı seçili; Express basit bir varsayılan HTTP çatısıdır.",
        ),
      },
    ],
  },
  {
    id: "rule-backend-scale-recommend-postgres",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 40,
    enabled: true,
    conditions: {
      all: [
        { field: "configuration.domainIds", operator: "includes", value: "domain-backend-api" },
        {
          field: "configuration.projectScale",
          operator: "includes-any",
          value: ["standard", "enterprise"],
        },
      ],
    },
    effects: [
      {
        type: "recommend",
        targetId: "database-postgresql",
        scoreDelta: 10,
        reasonCode: "SCALE_MATCH_RELATIONAL",
        reason: loc(
          "Standard/enterprise scale favors a durable relational database over an embedded one.",
          "Standart/kurumsal ölçek, gömülü bir veritabanı yerine dayanıklı bir ilişkisel veritabanını gerektirir.",
        ),
      },
    ],
  },
  {
    id: "rule-prototype-scale-recommend-sqlite",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 50,
    enabled: true,
    conditions: {
      all: [
        {
          field: "configuration.projectScale",
          operator: "includes-any",
          value: ["prototype", "mvp"],
        },
      ],
    },
    effects: [
      {
        type: "adjust-score",
        targetId: "database-sqlite",
        scoreDelta: 15,
        reasonCode: "PROTOTYPE_FRIENDLY",
        reason: loc(
          "Prototype/MVP scale favors a zero-setup embedded database.",
          "Prototip/MVP ölçeği kurulum gerektirmeyen gömülü bir veritabanını tercih eder.",
        ),
      },
    ],
  },
  {
    id: "rule-security-review-tag-require-lint-plugin",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 60,
    enabled: true,
    conditions: {
      all: [{ field: "requirementTags", operator: "includes", value: "security-review" }],
    },
    effects: [
      {
        type: "require",
        targetId: "security-tool-eslint-plugin-security",
        scoreDelta: 20,
        reasonCode: "REQUIREMENT_TAG_SECURITY_REVIEW",
        reason: loc(
          "A security-review requirement tag makes baseline static security linting required.",
          "Bir güvenlik incelemesi gereksinim etiketi, temel statik güvenlik lint denetimini zorunlu kılar.",
        ),
      },
    ],
  },
  {
    id: "rule-team-profile-recommend-qa-agent",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 70,
    enabled: true,
    conditions: {
      all: [{ field: "configuration.experienceProfile", operator: "equals", value: "team" }],
    },
    effects: [
      {
        type: "recommend",
        targetId: "agent-qa-reviewer",
        scoreDelta: 20,
        reasonCode: "TEAM_PROFILE_QA_ROLE",
        reason: loc(
          "Team profile separates implementation from independent QA review.",
          "Takım profili, uygulamayı bağımsız QA incelemesinden ayırır.",
        ),
      },
    ],
  },
  {
    id: "rule-team-security-tag-recommend-security-agent",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 80,
    enabled: true,
    conditions: {
      all: [
        { field: "configuration.experienceProfile", operator: "equals", value: "team" },
        { field: "requirementTags", operator: "includes", value: "security-review" },
      ],
    },
    effects: [
      {
        type: "recommend",
        targetId: "agent-security-reviewer",
        scoreDelta: 20,
        reasonCode: "TEAM_SECURITY_REVIEW_ROLE",
        reason: loc(
          "Team profile plus a security-review tag calls for an independent security reviewer role.",
          "Takım profili ile güvenlik incelemesi etiketi bağımsız bir güvenlik denetçisi rolünü gerektirir.",
        ),
      },
    ],
  },
  {
    id: "rule-baseline-recommend-lint-gate",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 90,
    enabled: true,
    conditions: { all: [{ field: "configuration.experienceProfile", operator: "exists" }] },
    effects: [
      {
        type: "recommend",
        targetId: "quality-gate-lint",
        scoreDelta: 10,
        reasonCode: "BASELINE_QUALITY_GATE",
        reason: loc(
          "A lint gate is a low-cost baseline quality check for any project.",
          "Lint kapısı, her proje için düşük maliyetli temel bir kalite denetimidir.",
        ),
      },
    ],
  },
  {
    id: "rule-typescript-accepted-recommend-typecheck-gate",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 100,
    enabled: true,
    conditions: {
      all: [{ field: "acceptedItemIds", operator: "includes", value: "language-typescript" }],
    },
    effects: [
      {
        type: "recommend",
        targetId: "quality-gate-typecheck",
        scoreDelta: 10,
        reasonCode: "TYPE_SAFETY_GATE",
        reason: loc(
          "TypeScript is selected, so a typecheck gate has something to check.",
          "TypeScript seçili, bu yüzden bir tip denetimi kapısının kontrol edeceği bir şey var.",
        ),
      },
    ],
  },
  {
    id: "rule-advanced-profile-recommend-git-mcp",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 110,
    enabled: true,
    conditions: {
      all: [
        {
          field: "configuration.experienceProfile",
          operator: "includes-any",
          value: ["advanced", "team"],
        },
      ],
    },
    effects: [
      {
        type: "adjust-score",
        targetId: "mcp-git",
        scoreDelta: 5,
        reasonCode: "ADVANCED_TOOLING_FIT",
        reason: loc(
          "Advanced/team profiles are more likely to use repository-aware tooling directly.",
          "İleri seviye/takım profilleri depo farkındalıklı araçları doğrudan kullanmaya daha yatkındır.",
        ),
      },
    ],
  },
  {
    id: "rule-small-scale-avoid-microservices",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 120,
    enabled: true,
    conditions: {
      all: [
        {
          field: "configuration.projectScale",
          operator: "includes-any",
          value: ["prototype", "mvp"],
        },
      ],
    },
    effects: [
      {
        type: "avoid",
        targetId: "architecture-microservices",
        scoreDelta: -30,
        reasonCode: "SCALE_TOO_SMALL_FOR_MICROSERVICES",
        reason: loc(
          "Prototype/MVP scale rarely justifies distributed-systems operational overhead.",
          "Prototip/MVP ölçeği nadiren dağıtık sistem operasyonel yükünü haklı çıkarır.",
        ),
      },
    ],
  },
  {
    id: "rule-data-domain-recommend-python",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 130,
    enabled: true,
    conditions: {
      all: [
        {
          field: "configuration.domainIds",
          operator: "includes-any",
          value: ["domain-data", "domain-ai-ml"],
        },
      ],
    },
    effects: [
      {
        type: "recommend",
        targetId: "language-python",
        scoreDelta: 15,
        reasonCode: "DOMAIN_MATCH_DATA",
        reason: loc(
          "Data/AI-ML domains are selected; Python has the largest ecosystem fit here.",
          "Veri/AI-ML alanları seçili; bu alanda en büyük ekosistem uyumuna Python sahiptir.",
        ),
      },
    ],
  },
  {
    id: "rule-cloud-devops-domain-recommend-docker",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 140,
    enabled: true,
    conditions: {
      all: [
        { field: "configuration.domainIds", operator: "includes", value: "domain-cloud-devops" },
      ],
    },
    effects: [
      {
        type: "recommend",
        targetId: "deployment-docker",
        scoreDelta: 10,
        reasonCode: "DOMAIN_MATCH_CLOUD_DEVOPS",
        reason: loc(
          "Cloud/DevOps domain is selected; containerizing the app is a common baseline step.",
          "Cloud/DevOps alanı seçili; uygulamayı konteynerleştirmek yaygın bir temel adımdır.",
        ),
      },
    ],
  },
  {
    id: "rule-automation-cli-domain-adjust-go",
    schemaVersion: 1,
    ruleVersion: "1.0.0",
    priority: 150,
    enabled: true,
    conditions: {
      all: [
        { field: "configuration.domainIds", operator: "includes", value: "domain-automation-cli" },
      ],
    },
    effects: [
      {
        type: "adjust-score",
        targetId: "language-go",
        scoreDelta: 10,
        reasonCode: "DOMAIN_MATCH_AUTOMATION",
        reason: loc(
          "Automation/CLI domain is selected; Go compiles to a single portable binary.",
          "Otomasyon/CLI alanı seçili; Go, taşınabilir tek bir ikili dosyaya derlenir.",
        ),
      },
    ],
  },
];
