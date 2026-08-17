import claudeMd from "../../../templates/generated-package/CLAUDE.template.md?raw";
import claudeSettingsJson from "../../../templates/generated-package/claude-settings.template.json?raw";
import projectConfigJson from "../../../templates/generated-package/project.config.json.tmpl?raw";
import projectBrief from "../../../templates/generated-package/PROJECT_BRIEF.template.md?raw";
import requirements from "../../../templates/generated-package/REQUIREMENTS.template.md?raw";
import architecture from "../../../templates/generated-package/ARCHITECTURE.template.md?raw";
import securityPlan from "../../../templates/generated-package/SECURITY_PLAN.template.md?raw";
import testPlan from "../../../templates/generated-package/TEST_PLAN.template.md?raw";
import roadmap from "../../../templates/generated-package/ROADMAP.template.md?raw";
import tasks from "../../../templates/generated-package/TASKS.template.md?raw";
import mcpRecommendations from "../../../templates/generated-package/MCP_RECOMMENDATIONS.template.md?raw";
import readme from "../../../templates/generated-package/README.template.md?raw";
import apiContract from "../../../templates/generated-package/API_CONTRACT.template.md?raw";
import decisionLog from "../../../templates/generated-package/DECISION_LOG.template.md?raw";
import agentFrontendEngineer from "../../../templates/generated-package/agents/frontend-engineer.template.md?raw";
import agentQaReviewer from "../../../templates/generated-package/agents/qa-reviewer.template.md?raw";
import agentSecurityReviewer from "../../../templates/generated-package/agents/security-reviewer.template.md?raw";
import skillCodeReview from "../../../templates/generated-package/skills/code-review.template.md?raw";
import skillTestGeneration from "../../../templates/generated-package/skills/test-generation.template.md?raw";
import skillDocumentationWriter from "../../../templates/generated-package/skills/documentation-writer.template.md?raw";

/** Canonical version stamp for `PackageManifest.templateSetVersion` — bump when any template file's rendered output changes. */
export const TEMPLATE_SET_VERSION = "1.0.0";

export const CORE_TEMPLATES = {
  claudeMd,
  claudeSettingsJson,
  projectConfigJson,
  projectBrief,
  requirements,
  architecture,
  securityPlan,
  testPlan,
  roadmap,
  tasks,
  mcpRecommendations,
} as const;

/** Keyed by `CatalogItemDetailsMap["agent"]["contentTemplateId"]`. */
export const AGENT_TEMPLATES: Record<string, { outputPath: string; content: string }> = {
  "agent-template-frontend-engineer": {
    outputPath: ".claude/agents/frontend-engineer.md",
    content: agentFrontendEngineer,
  },
  "agent-template-qa-reviewer": {
    outputPath: ".claude/agents/qa-reviewer.md",
    content: agentQaReviewer,
  },
  "agent-template-security-reviewer": {
    outputPath: ".claude/agents/security-reviewer.md",
    content: agentSecurityReviewer,
  },
};

/** Keyed by `CatalogItemDetailsMap["skill"]["contentTemplateId"]`. */
export const SKILL_TEMPLATES: Record<string, { outputPath: string; content: string }> = {
  "skill-template-code-review": {
    outputPath: ".claude/skills/code-review/SKILL.md",
    content: skillCodeReview,
  },
  "skill-template-test-generation": {
    outputPath: ".claude/skills/test-generation/SKILL.md",
    content: skillTestGeneration,
  },
  "skill-template-documentation-writer": {
    outputPath: ".claude/skills/documentation-writer/SKILL.md",
    content: skillDocumentationWriter,
  },
};

/** Keyed by `CatalogItemDetailsMap["document-template"]["templateId"]`; `outputPathTemplate` comes from the catalog item itself. */
export const DOCUMENT_TEMPLATES: Record<string, string> = {
  "document-template-readme": readme,
  "document-template-api-contract": apiContract,
  "document-template-decision-log": decisionLog,
};
