import type { CatalogItem } from "@contracts/catalog";
import type { Identifier } from "@contracts/common";
import type { GeneratedFile, GeneratedFileSource } from "@contracts/package";
import type { Project } from "@contracts/project";
import type { ValidationIssue } from "@contracts/validation";

import {
  AGENT_TEMPLATES,
  CORE_TEMPLATES,
  DOCUMENT_TEMPLATES,
  SKILL_TEMPLATES,
} from "../catalog/packageTemplates";

/** Pure package-generation logic (`PACKAGE_GENERATOR.md`). Never imports browser/Node globals — hashing and downloads live in `application/packageStore.ts` and `adapters/`. */

export const PACKAGE_GENERATOR_VERSION = "1.0.0";

export interface RenderedFile {
  path: string;
  mediaType: GeneratedFile["mediaType"];
  content: string;
  source: GeneratedFileSource;
  sourceId?: Identifier;
  inclusionReason: string;
  required: boolean;
  editable: boolean;
  excludable: boolean;
}

export interface PackageFileSet {
  files: RenderedFile[];
  issues: ValidationIssue[];
}

// ---------------------------------------------------------------------------
// Path safety (PACKAGE_GENERATOR.md "Path policy")
// ---------------------------------------------------------------------------

const RESERVED_WINDOWS_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function validatePackagePath(rawPath: string): string | undefined {
  if (!rawPath || rawPath.trim().length === 0) return "PATH_EMPTY";
  if (rawPath.length > 500) return "PATH_TOO_LONG";
  if (hasControlCharacter(rawPath)) return "PATH_CONTROL_CHARACTER";
  const normalized = rawPath.replace(/\\/g, "/");
  if (normalized.startsWith("//")) return "PATH_UNC_PREFIX";
  if (normalized.startsWith("/")) return "PATH_ABSOLUTE";
  if (/^[A-Za-z]:/.test(normalized)) return "PATH_DRIVE_PREFIX";
  const segments = normalized.split("/");
  for (const segment of segments) {
    if (segment.length === 0) return "PATH_EMPTY_SEGMENT";
    if (segment === "." || segment === "..") return "PATH_TRAVERSAL_SEGMENT";
    const bareName = segment.split(".")[0]?.toLowerCase() ?? "";
    if (RESERVED_WINDOWS_NAMES.has(bareName)) return "PATH_RESERVED_NAME";
    if (/[<>:"|?*]/.test(segment)) return "PATH_INVALID_CHARACTER";
  }
  return undefined;
}

/** NFC-normalized, case-folded key used to detect cross-platform path collisions. */
export function pathCollisionKey(rawPath: string): string {
  return rawPath.replace(/\\/g, "/").normalize("NFC").toLowerCase();
}

// ---------------------------------------------------------------------------
// Secret-pattern scan (defense-in-depth, not a guarantee — SECURITY_PLAN.md THR-002)
// ---------------------------------------------------------------------------

const SECRET_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "aws-access-key-id", pattern: /AKIA[0-9A-Z]{16}/ },
  { label: "private-key-block", pattern: /-----BEGIN[ A-Z]*PRIVATE KEY-----/ },
  {
    label: "generic-api-key-assignment",
    pattern: /api[_-]?key["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i,
  },
  { label: "bearer-token", pattern: /Bearer\s+[A-Za-z0-9\-_.]{20,}/ },
  {
    label: "dotenv-secret-assignment",
    pattern: /(?:SECRET|TOKEN|PASSWORD)[A-Z0-9_]*\s*=\s*\S{8,}/,
  },
];

export function scanForSecretPatterns(content: string): string[] {
  const hits: string[] = [];
  for (const { label, pattern } of SECRET_PATTERNS) {
    if (pattern.test(content)) hits.push(label);
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Template rendering
// ---------------------------------------------------------------------------

const VAR_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(VAR_PATTERN, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match,
  );
}

export function jsonArrayLiteral(values: string[]): string {
  return JSON.stringify(values);
}

function mdList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "_(none recorded)_";
}

function joinOrNone(items: string[]): string {
  return items.length > 0 ? items.join(", ") : "(none)";
}

// ---------------------------------------------------------------------------
// Template variables
// ---------------------------------------------------------------------------

export function buildTemplateVars(
  project: Project,
  catalogItems: CatalogItem[],
): Record<string, string> {
  const domainNames = [
    ...project.configuration.domainIds,
    ...project.configuration.customDomainIds,
  ].map(
    (id) =>
      project.configuration.customDomainLabels[id] ??
      catalogItems.find((item) => item.id === id)?.name ??
      id,
  );
  const acceptedNames = project.selections
    .filter((selection) => selection.decision === "accepted")
    .map((selection) => selection.snapshot.name);
  const functionalRequirements = project.requirements.filter((r) => r.type === "functional");
  const nonFunctionalRequirements = project.requirements.filter((r) => r.type === "non-functional");
  const acceptanceCriteria = project.requirements.flatMap((requirement) =>
    requirement.acceptanceCriteria.map(
      (ac) => `${requirement.title}: given ${ac.given}, when ${ac.when}, then ${ac.then}`,
    ),
  );

  return {
    PROJECT_NAME: project.meta.name,
    PROJECT_PURPOSE: project.brief.idea || "(not yet defined)",
    PRIMARY_PROFILE: project.configuration.experienceProfile,
    OUTPUT_LANGUAGE: project.configuration.outputLanguage,
    EXECUTION_PROFILE: project.configuration.executionProfile,
    OWNER: project.meta.owner ?? "(unassigned)",
    TARGET_USERS: joinOrNone(project.brief.targetUsers),
    DOMAINS: joinOrNone(domainNames),
    PLATFORMS: joinOrNone(project.configuration.targetPlatforms),
    PROJECT_SCALE: project.configuration.projectScale,
    PROBLEM: project.brief.problem || "(not yet defined)",
    PROPOSED_SOLUTION: project.brief.proposedSolution || "(not yet defined)",
    GOALS_AND_MEASURES: mdList([...project.brief.goals, ...project.brief.successMeasures]),
    V1_SCOPE: mdList(acceptedNames),
    OUT_OF_SCOPE: "_(record explicitly excluded scope here)_",
    CONSTRAINTS_AND_ASSUMPTIONS: mdList(project.brief.constraints),
    FUNCTIONAL_REQUIREMENTS: mdList(
      functionalRequirements.map((r) => `[${r.priority}] ${r.title} — ${r.description}`),
    ),
    NON_FUNCTIONAL_REQUIREMENTS: mdList(
      nonFunctionalRequirements.map((r) => `[${r.priority}] ${r.title} — ${r.description}`),
    ),
    ACCEPTANCE_CRITERIA: mdList(acceptanceCriteria),
    EXCLUSIONS_AND_QUESTIONS: "_(record exclusions and open questions here)_",
    SELECTED_STACK: joinOrNone(acceptedNames),
    ARCHITECTURAL_STYLE: joinOrNone(
      project.selections
        .filter((s) => s.decision === "accepted" && s.snapshot.kind === "architecture")
        .map((s) => s.snapshot.name),
    ),
    ARCHITECTURE_RATIONALE: "_(record architecture rationale here)_",
    SYSTEM_CONTEXT: "_(record system context here)_",
    COMPONENTS_AND_BOUNDARIES: "_(record components and boundaries here)_",
    DATA_AND_INTEGRATIONS: "_(record data and integrations here)_",
    FORBIDDEN_DEPENDENCIES: mdList(project.configuration.forbiddenTechnologies),
    FAILURE_AND_RECOVERY: "_(record failure and recovery behavior here)_",
    ASSETS_AND_BOUNDARIES: "_(record assets, actors, and trust boundaries here)_",
    THREATS_AND_CONTROLS: "_(record threats and controls here)_",
    SECURITY_TESTS: "_(record security tests here)_",
    RESIDUAL_RISKS: "_(record residual risks here)_",
    CRITICAL_FLOWS_AND_RISKS: "_(record critical flows and risks here)_",
    TEST_LEVELS: "_(record test levels and tools here)_",
    TEST_CASES: mdList(
      project.requirements.map(
        (r) => `${r.title} — verification: ${r.verificationMethods.join(", ") || "(unspecified)"}`,
      ),
    ),
    QUALITY_GATES: joinOrNone(
      project.selections
        .filter((s) => s.decision === "accepted" && s.snapshot.kind === "quality-gate")
        .map((s) => s.snapshot.name),
    ),
    MILESTONES: "_(record project-specific milestones here)_",
    REPLANNING_TRIGGERS: "_(record replanning triggers here)_",
    TASK_ROWS: "",
    MCP_RECOMMENDATIONS: mdList(
      project.selections
        .filter((s) => s.decision === "accepted" && s.snapshot.kind === "mcp")
        .map((s) => s.snapshot.name),
    ),
    SETUP_INSTRUCTIONS: "_(record setup instructions here)_",
    USAGE_INSTRUCTIONS: "_(record usage instructions here)_",
    ENDPOINTS: "_(record endpoints here)_",
    ERROR_ENVELOPE: "_(record the error envelope shape here)_",
    VERSIONING_NOTES: "_(record versioning notes here)_",
    DECISION_ROWS: "",
  };
}

export function buildConfigJsonVars(
  project: Project,
  catalogVersion: string,
  ruleSetVersion: string,
): Record<string, string> {
  const acceptedItemIds = project.selections
    .filter((selection) => selection.decision === "accepted" && selection.itemId)
    .map((selection) => selection.itemId as Identifier);
  return {
    PROJECT_NAME: project.meta.name,
    OWNER: project.meta.owner ?? "(unassigned)",
    EXPERIENCE_PROFILE: project.configuration.experienceProfile,
    SELECTION_MODE: project.configuration.selectionMode,
    EXECUTION_PROFILE: project.configuration.executionProfile,
    OUTPUT_LANGUAGE: project.configuration.outputLanguage,
    DOMAIN_IDS_JSON: jsonArrayLiteral([
      ...project.configuration.domainIds,
      ...project.configuration.customDomainIds,
    ]),
    TARGET_PLATFORMS_JSON: jsonArrayLiteral(project.configuration.targetPlatforms),
    CATALOG_VERSION: catalogVersion,
    RULE_SET_VERSION: ruleSetVersion,
    SELECTED_ITEM_IDS_JSON: jsonArrayLiteral(acceptedItemIds),
  };
}

// ---------------------------------------------------------------------------
// File resolution
// ---------------------------------------------------------------------------

function issue(
  id: string,
  code: string,
  severity: ValidationIssue["severity"],
  message: string,
  path?: string,
): ValidationIssue {
  return {
    id,
    code,
    category: "package",
    severity,
    message,
    path,
    relatedIds: [],
    resolutions: [],
  };
}

export interface BuildFileSetInput {
  project: Project;
  catalogItems: CatalogItem[];
  catalogVersion: string;
  ruleSetVersion: string;
}

export function buildFileSet(input: BuildFileSetInput): PackageFileSet {
  const { project, catalogItems, catalogVersion, ruleSetVersion } = input;
  const settings = project.packageSettings;
  const files: RenderedFile[] = [];
  const issues: ValidationIssue[] = [];
  const vars = buildTemplateVars(project, catalogItems);

  function push(file: RenderedFile): void {
    files.push({
      ...file,
      content:
        settings.textOverrides[file.path] !== undefined
          ? settings.textOverrides[file.path]
          : file.content,
    });
  }

  if (settings.includeClaudeMd) {
    push({
      path: "CLAUDE.md",
      mediaType: "text/markdown",
      content: renderTemplate(CORE_TEMPLATES.claudeMd, vars),
      source: "core",
      inclusionReason: "Always-on project contract read at session start.",
      required: true,
      editable: true,
      excludable: false,
    });
  }

  if (settings.includeProjectConfig) {
    push({
      path: "project.config.json",
      mediaType: "application/json",
      content: renderTemplate(
        CORE_TEMPLATES.projectConfigJson,
        buildConfigJsonVars(project, catalogVersion, ruleSetVersion),
      ),
      source: "core",
      inclusionReason: "Machine-readable project/approvals configuration.",
      required: true,
      editable: false,
      excludable: false,
    });
  }

  if (settings.includeSafeSettings) {
    push({
      path: ".claude/settings.json",
      mediaType: "application/json",
      content: CORE_TEMPLATES.claudeSettingsJson,
      source: "core",
      inclusionReason: "Restrictive ask/deny permission defaults.",
      required: true,
      editable: false,
      excludable: false,
    });
  }

  if (settings.includeDocuments) {
    const coreDocs: Array<[string, string]> = [
      ["docs/PROJECT_BRIEF.md", CORE_TEMPLATES.projectBrief],
      ["docs/REQUIREMENTS.md", CORE_TEMPLATES.requirements],
      ["docs/ARCHITECTURE.md", CORE_TEMPLATES.architecture],
      ["docs/SECURITY_PLAN.md", CORE_TEMPLATES.securityPlan],
      ["docs/TEST_PLAN.md", CORE_TEMPLATES.testPlan],
      ["docs/ROADMAP.md", CORE_TEMPLATES.roadmap],
    ];
    for (const [path, template] of coreDocs) {
      push({
        path,
        mediaType: "text/markdown",
        content: renderTemplate(template, vars),
        source: "core",
        inclusionReason: "Core project document (packageSettings.includeDocuments).",
        required: false,
        editable: true,
        excludable: true,
      });
    }
  }

  if (settings.includeTaskFiles) {
    push({
      path: "tasks/todo.md",
      mediaType: "text/markdown",
      content: renderTemplate(CORE_TEMPLATES.tasks, vars),
      source: "core",
      inclusionReason: "Active task tracker (packageSettings.includeTaskFiles).",
      required: false,
      editable: true,
      excludable: true,
    });
    push({
      path: "tasks/lessons.md",
      mediaType: "text/markdown",
      content: `# Lessons — ${project.meta.name}\n\nRecord short, verified, reusable lessons here.\n`,
      source: "core",
      inclusionReason: "Lessons log (packageSettings.includeTaskFiles).",
      required: false,
      editable: true,
      excludable: true,
    });
  }

  if (settings.includeMcpRecommendations) {
    push({
      path: "mcp/recommendations.md",
      mediaType: "text/markdown",
      content: renderTemplate(CORE_TEMPLATES.mcpRecommendations, vars),
      source: "core",
      inclusionReason:
        "MCP is recommendation-only in V1 (packageSettings.includeMcpRecommendations).",
      required: false,
      editable: true,
      excludable: true,
    });
  }

  const acceptedSelections = project.selections.filter(
    (selection) => selection.decision === "accepted",
  );

  for (const selection of acceptedSelections) {
    const kind = selection.snapshot.kind;
    if (kind === "agent" && settings.includeAgents) {
      const item = catalogItems.find((candidate) => candidate.id === selection.itemId);
      const templateId = item && item.kind === "agent" ? item.details.contentTemplateId : undefined;
      const template = templateId ? AGENT_TEMPLATES[templateId] : undefined;
      if (!template) {
        issues.push(
          issue(
            `package-missing-template-${selection.id}`,
            "MISSING_TEMPLATE_MAPPING",
            "blocker",
            `Selected agent "${selection.snapshot.name}" has no registered template content.`,
            selection.itemId,
          ),
        );
        continue;
      }
      push({
        path: template.outputPath,
        mediaType: "text/markdown",
        content: renderTemplate(template.content, vars),
        source: "catalog-item",
        sourceId: selection.itemId,
        inclusionReason: `Selected agent: ${selection.snapshot.name}.`,
        required: false,
        editable: true,
        excludable: true,
      });
    }

    if (kind === "skill" && settings.includeSkills) {
      const item = catalogItems.find((candidate) => candidate.id === selection.itemId);
      const templateId = item && item.kind === "skill" ? item.details.contentTemplateId : undefined;
      const template = templateId ? SKILL_TEMPLATES[templateId] : undefined;
      if (!template) {
        issues.push(
          issue(
            `package-missing-template-${selection.id}`,
            "MISSING_TEMPLATE_MAPPING",
            "blocker",
            `Selected skill "${selection.snapshot.name}" has no registered template content.`,
            selection.itemId,
          ),
        );
        continue;
      }
      push({
        path: template.outputPath,
        mediaType: "text/markdown",
        content: renderTemplate(template.content, vars),
        source: "catalog-item",
        sourceId: selection.itemId,
        inclusionReason: `Selected skill: ${selection.snapshot.name}.`,
        required: false,
        editable: true,
        excludable: true,
      });
    }

    if (kind === "document-template" && settings.includeDocuments) {
      const item = catalogItems.find((candidate) => candidate.id === selection.itemId);
      if (!item || item.kind !== "document-template") continue;
      const template = DOCUMENT_TEMPLATES[item.details.templateId];
      if (!template) {
        issues.push(
          issue(
            `package-missing-template-${selection.id}`,
            "MISSING_TEMPLATE_MAPPING",
            "blocker",
            `Selected document "${selection.snapshot.name}" has no registered template content.`,
            selection.itemId,
          ),
        );
        continue;
      }
      push({
        path: item.details.outputPathTemplate,
        mediaType: "text/markdown",
        content: renderTemplate(template, vars),
        source: "catalog-item",
        sourceId: selection.itemId,
        inclusionReason: `Selected document: ${selection.snapshot.name}.`,
        required: false,
        editable: true,
        excludable: true,
      });
    }
  }

  const excludedPaths = new Set(settings.excludedOptionalPaths);
  const nonExcludedFiles = files.filter(
    (file) => !(file.excludable && excludedPaths.has(file.path)),
  );

  // Path safety
  const seenKeys = new Map<string, string>();
  for (const file of nonExcludedFiles) {
    const pathIssue = validatePackagePath(file.path);
    if (pathIssue) {
      issues.push(
        issue(
          `package-path-${file.path}`,
          pathIssue,
          "blocker",
          `Unsafe path: ${file.path}`,
          file.path,
        ),
      );
      continue;
    }
    const key = pathCollisionKey(file.path);
    const existing = seenKeys.get(key);
    if (existing !== undefined) {
      issues.push(
        issue(
          `package-duplicate-${key}`,
          "PATH_DUPLICATE",
          "blocker",
          `"${file.path}" collides with "${existing}" after normalization.`,
          file.path,
        ),
      );
      continue;
    }
    seenKeys.set(key, file.path);

    const secretHits = scanForSecretPatterns(file.content);
    for (const label of secretHits) {
      issues.push(
        issue(
          `package-secret-${label}-${file.path}`,
          "SECRET_PATTERN_DETECTED",
          "blocker",
          `Possible secret pattern ("${label}") found in ${file.path}. Remove it before export.`,
          file.path,
        ),
      );
    }
  }

  const safeFiles = nonExcludedFiles.filter((file) => validatePackagePath(file.path) === undefined);
  const duplicateOrSecretPaths = new Set(
    issues
      .filter((i) => i.code === "PATH_DUPLICATE" || i.code === "SECRET_PATTERN_DETECTED")
      .map((i) => i.path),
  );
  const finalFiles = safeFiles
    .filter((file) => !duplicateOrSecretPaths.has(file.path))
    .sort((a, b) => a.path.localeCompare(b.path));

  return { files: finalFiles, issues };
}
