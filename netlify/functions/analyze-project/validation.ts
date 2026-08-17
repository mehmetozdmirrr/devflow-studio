import type {
  AIAnalysisRequest,
  AIAnalysisResult,
  AIClarificationQuestion,
  AICustomCatalogProposal,
  AIErrorCode,
  AIErrorEnvelope,
  AIRequirementProposal,
} from "@contracts/ai";
import type { Identifier } from "@contracts/common";

/** Pure request/response validation and error-envelope helpers for `analyze-project` — no network/provider dependency, matching `ai-analysis-request.schema.json` / `ai-analysis-result.schema.json` / API_CONTRACT.md. */

export const MAX_REQUEST_BYTES = 32_000;

const SUPPORTED_LOCALES = new Set(["tr", "en"]);
const SUPPORTED_EXPERIENCE_PROFILES = new Set(["beginner", "intermediate", "advanced", "team"]);
const SUPPORTED_SCALES = new Set(["prototype", "mvp", "standard", "enterprise"]);
const SUPPORTED_REQUIREMENT_TYPES = new Set(["functional", "non-functional", "constraint"]);
const SUPPORTED_REQUIREMENT_PRIORITIES = new Set(["must", "should", "could", "wont"]);
const SUPPORTED_AFFECTS = new Set(["scope", "stack", "architecture", "security", "testing"]);
const SUPPORTED_COMPLEXITY = new Set(["prototype", "standard", "complex"]);
export const SUPPORTED_CONSENT_NOTICE_VERSIONS = new Set(["ai-notice-v1", "phase-1-preview"]);

const ERROR_SPEC: Record<AIErrorCode, { message: string; retryable: boolean; fallback: string }> = {
  INVALID_REQUEST: {
    message: "The analysis request was malformed.",
    retryable: false,
    fallback: "Continue with deterministic recommendations.",
  },
  CONSENT_REQUIRED: {
    message: "Explicit AI consent is required before this request can be sent.",
    retryable: false,
    fallback: "Continue with deterministic recommendations.",
  },
  PAYLOAD_TOO_LARGE: {
    message: "The analysis request exceeded the allowed size.",
    retryable: false,
    fallback: "Shorten the project brief and try again, or continue with deterministic recommendations.",
  },
  ORIGIN_NOT_ALLOWED: {
    message: "This origin is not permitted to call AI analysis.",
    retryable: false,
    fallback: "Continue with deterministic recommendations.",
  },
  AI_DISABLED: {
    message: "AI analysis is not enabled on this deployment.",
    retryable: false,
    fallback: "Continue with deterministic recommendations.",
  },
  AI_RATE_LIMITED: {
    message: "AI analysis is temporarily unavailable.",
    retryable: true,
    fallback: "Continue with deterministic recommendations.",
  },
  AI_TIMEOUT: {
    message: "AI analysis timed out.",
    retryable: true,
    fallback: "Continue with deterministic recommendations.",
  },
  AI_PROVIDER_ERROR: {
    message: "The AI provider could not complete the request.",
    retryable: true,
    fallback: "Continue with deterministic recommendations.",
  },
  AI_INVALID_OUTPUT: {
    message: "AI analysis returned an invalid result.",
    retryable: true,
    fallback: "Continue with deterministic recommendations.",
  },
  INTERNAL_ERROR: {
    message: "An unexpected server error occurred.",
    retryable: true,
    fallback: "Continue with deterministic recommendations.",
  },
};

export function buildErrorEnvelope(requestId: string, code: AIErrorCode): AIErrorEnvelope {
  const spec = ERROR_SPEC[code];
  return { schemaVersion: 1, requestId, error: { code, ...spec } };
}

export const HTTP_STATUS_BY_CODE: Record<AIErrorCode, number> = {
  INVALID_REQUEST: 400,
  CONSENT_REQUIRED: 400,
  PAYLOAD_TOO_LARGE: 413,
  ORIGIN_NOT_ALLOWED: 403,
  AI_DISABLED: 503,
  AI_RATE_LIMITED: 429,
  AI_TIMEOUT: 504,
  AI_PROVIDER_ERROR: 502,
  AI_INVALID_OUTPUT: 502,
  INTERNAL_ERROR: 500,
};

// ---------------------------------------------------------------------------
// Small shape-guard helpers (no schema library — matches the app's existing
// hand-written-guard precedent rather than adding a new dependency).
// ---------------------------------------------------------------------------

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= maxLength;
}

function isString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isStringArray(value: unknown, maxItems: number, maxItemLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => typeof item === "string" && item.length <= maxItemLength)
  );
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

export type RequestValidationResult =
  | { ok: true; request: AIAnalysisRequest }
  | { ok: false; code: Extract<AIErrorCode, "INVALID_REQUEST" | "CONSENT_REQUIRED"> };

export function validateAnalysisRequest(body: unknown): RequestValidationResult {
  if (!isPlainObject(body)) return { ok: false, code: "INVALID_REQUEST" };
  if (
    !hasOnlyKeys(body, [
      "schemaVersion",
      "requestId",
      "locale",
      "outputLanguage",
      "consent",
      "project",
      "catalogContext",
    ])
  ) {
    return { ok: false, code: "INVALID_REQUEST" };
  }
  if (body.schemaVersion !== 1) return { ok: false, code: "INVALID_REQUEST" };
  if (!isNonEmptyString(body.requestId, 100)) return { ok: false, code: "INVALID_REQUEST" };
  if (typeof body.locale !== "string" || !SUPPORTED_LOCALES.has(body.locale)) {
    return { ok: false, code: "INVALID_REQUEST" };
  }
  if (typeof body.outputLanguage !== "string" || !SUPPORTED_LOCALES.has(body.outputLanguage)) {
    return { ok: false, code: "INVALID_REQUEST" };
  }

  const consent = body.consent;
  if (!isPlainObject(consent) || !hasOnlyKeys(consent, ["accepted", "acceptedAt", "noticeVersion"])) {
    return { ok: false, code: "INVALID_REQUEST" };
  }
  if (typeof consent.acceptedAt !== "string" || typeof consent.noticeVersion !== "string") {
    return { ok: false, code: "INVALID_REQUEST" };
  }
  if (!SUPPORTED_CONSENT_NOTICE_VERSIONS.has(consent.noticeVersion)) {
    return { ok: false, code: "INVALID_REQUEST" };
  }
  if (consent.accepted !== true) return { ok: false, code: "CONSENT_REQUIRED" };

  const project = body.project;
  if (
    !isPlainObject(project) ||
    !hasOnlyKeys(project, [
      "idea",
      "problem",
      "targetUsers",
      "selectedDomainIds",
      "targetPlatforms",
      "experienceProfile",
      "scale",
      "knownRequirements",
    ])
  ) {
    return { ok: false, code: "INVALID_REQUEST" };
  }
  if (!isNonEmptyString(project.idea, 5000)) return { ok: false, code: "INVALID_REQUEST" };
  if (!isString(project.problem, 5000)) return { ok: false, code: "INVALID_REQUEST" };
  if (!isStringArray(project.targetUsers, 20, 300)) return { ok: false, code: "INVALID_REQUEST" };
  if (!isStringArray(project.selectedDomainIds, 20, 100)) return { ok: false, code: "INVALID_REQUEST" };
  if (!isStringArray(project.targetPlatforms, 20, 100)) return { ok: false, code: "INVALID_REQUEST" };
  if (
    typeof project.experienceProfile !== "string" ||
    !SUPPORTED_EXPERIENCE_PROFILES.has(project.experienceProfile)
  ) {
    return { ok: false, code: "INVALID_REQUEST" };
  }
  if (typeof project.scale !== "string" || !SUPPORTED_SCALES.has(project.scale)) {
    return { ok: false, code: "INVALID_REQUEST" };
  }
  if (!Array.isArray(project.knownRequirements) || project.knownRequirements.length > 100) {
    return { ok: false, code: "INVALID_REQUEST" };
  }
  for (const requirement of project.knownRequirements) {
    if (
      !isPlainObject(requirement) ||
      !hasOnlyKeys(requirement, ["type", "title", "description", "priority"]) ||
      typeof requirement.type !== "string" ||
      !SUPPORTED_REQUIREMENT_TYPES.has(requirement.type) ||
      !isNonEmptyString(requirement.title, 200) ||
      !isString(requirement.description, 2000) ||
      typeof requirement.priority !== "string" ||
      !SUPPORTED_REQUIREMENT_PRIORITIES.has(requirement.priority)
    ) {
      return { ok: false, code: "INVALID_REQUEST" };
    }
  }

  const catalogContext = body.catalogContext;
  if (
    !isPlainObject(catalogContext) ||
    !hasOnlyKeys(catalogContext, ["catalogVersion", "allowedItemIds"])
  ) {
    return { ok: false, code: "INVALID_REQUEST" };
  }
  if (!isNonEmptyString(catalogContext.catalogVersion, 50)) return { ok: false, code: "INVALID_REQUEST" };
  if (!isStringArray(catalogContext.allowedItemIds, 500, 100)) {
    return { ok: false, code: "INVALID_REQUEST" };
  }

  return { ok: true, request: body as unknown as AIAnalysisRequest };
}

// ---------------------------------------------------------------------------
// Provider-output validation and allowlist filtering
// ---------------------------------------------------------------------------

function toUnverifiedProposal(idOrProposal: string | Record<string, unknown>): AICustomCatalogProposal {
  if (typeof idOrProposal === "string") {
    return {
      name: idOrProposal,
      kind: "catalog-item",
      reason: "Not in the allowed catalog id set for this request.",
      verification: "unverified",
    };
  }
  return {
    name: isNonEmptyString(idOrProposal.name, 200) ? idOrProposal.name : "unnamed",
    kind: isNonEmptyString(idOrProposal.kind, 100) ? idOrProposal.kind : "unknown",
    reason: isString(idOrProposal.reason, 1000) ? idOrProposal.reason : "",
    verification: "unverified",
    ...(isString(idOrProposal.documentationUrl, 1000)
      ? { documentationUrl: idOrProposal.documentationUrl }
      : {}),
  };
}

function isValidQuestion(value: unknown): value is AIClarificationQuestion {
  return (
    isPlainObject(value) &&
    isNonEmptyString(value.id, 100) &&
    isString(value.question, 500) &&
    isString(value.reason, 1000) &&
    Array.isArray(value.affects) &&
    value.affects.every((a) => typeof a === "string" && SUPPORTED_AFFECTS.has(a)) &&
    typeof value.requiredBeforeGeneration === "boolean"
  );
}

function isValidRequirementProposal(value: unknown): value is AIRequirementProposal {
  return (
    isPlainObject(value) &&
    isNonEmptyString(value.id, 100) &&
    typeof value.type === "string" &&
    SUPPORTED_REQUIREMENT_TYPES.has(value.type) &&
    isString(value.title, 200) &&
    isString(value.description, 2000) &&
    typeof value.priority === "string" &&
    SUPPORTED_REQUIREMENT_PRIORITIES.has(value.priority) &&
    isString(value.reason, 1000)
  );
}

export type ProviderOutputResult =
  | { ok: true; result: AIAnalysisResult }
  | { ok: false; code: "AI_INVALID_OUTPUT" };

export function mapProviderOutputToResult(
  requestId: Identifier,
  analysisId: Identifier,
  raw: unknown,
  allowedItemIds: readonly Identifier[],
): ProviderOutputResult {
  if (!isPlainObject(raw)) return { ok: false, code: "AI_INVALID_OUTPUT" };
  const classification = raw.classification;
  if (
    !isPlainObject(classification) ||
    !Array.isArray(classification.domainIds) ||
    classification.domainIds.length > 20 ||
    !classification.domainIds.every((id) => typeof id === "string" && id.length <= 100) ||
    typeof classification.complexity !== "string" ||
    !SUPPORTED_COMPLEXITY.has(classification.complexity) ||
    typeof classification.confidence !== "number" ||
    classification.confidence < 0 ||
    classification.confidence > 1
  ) {
    return { ok: false, code: "AI_INVALID_OUTPUT" };
  }

  const clarificationQuestions = raw.clarificationQuestions;
  if (
    !Array.isArray(clarificationQuestions) ||
    clarificationQuestions.length > 30 ||
    !clarificationQuestions.every(isValidQuestion)
  ) {
    return { ok: false, code: "AI_INVALID_OUTPUT" };
  }

  const proposedRequirements = raw.proposedRequirements;
  if (
    !Array.isArray(proposedRequirements) ||
    proposedRequirements.length > 100 ||
    !proposedRequirements.every(isValidRequirementProposal)
  ) {
    return { ok: false, code: "AI_INVALID_OUTPUT" };
  }

  const recommendedItemIdsRaw = raw.recommendedItemIds;
  if (
    !Array.isArray(recommendedItemIdsRaw) ||
    recommendedItemIdsRaw.length > 100 ||
    !recommendedItemIdsRaw.every((id) => typeof id === "string" && id.length <= 100)
  ) {
    return { ok: false, code: "AI_INVALID_OUTPUT" };
  }

  const modelCustomProposalsRaw = raw.customProposals;
  if (!Array.isArray(modelCustomProposalsRaw) || modelCustomProposalsRaw.length > 30) {
    return { ok: false, code: "AI_INVALID_OUTPUT" };
  }

  for (const list of [raw.risks, raw.testNeeds, raw.documentNeeds, raw.warnings]) {
    if (!isStringArray(list, 50, 1000)) return { ok: false, code: "AI_INVALID_OUTPUT" };
  }

  const allowedSet = new Set(allowedItemIds);
  const recommendedItemIds = recommendedItemIdsRaw.filter((id) => allowedSet.has(id));
  const disallowedIds = recommendedItemIdsRaw.filter((id) => !allowedSet.has(id));

  const customProposals: AICustomCatalogProposal[] = [
    ...disallowedIds.map((id) => toUnverifiedProposal(id)),
    ...modelCustomProposalsRaw
      .filter((item): item is Record<string, unknown> => isPlainObject(item))
      .map((item) => toUnverifiedProposal(item)),
  ].slice(0, 30);

  const result: AIAnalysisResult = {
    schemaVersion: 1,
    requestId,
    analysisId,
    classification: {
      domainIds: classification.domainIds,
      complexity: classification.complexity as "prototype" | "standard" | "complex",
      confidence: classification.confidence,
    },
    clarificationQuestions,
    proposedRequirements,
    recommendedItemIds,
    customProposals,
    risks: raw.risks as string[],
    testNeeds: raw.testNeeds as string[],
    documentNeeds: raw.documentNeeds as string[],
    warnings: raw.warnings as string[],
  };
  return { ok: true, result };
}
