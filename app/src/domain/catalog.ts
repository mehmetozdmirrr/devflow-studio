import type { CatalogItem, CatalogItemKind, CatalogRelation } from "@contracts/catalog";
import type {
  CatalogOrigin,
  Difficulty,
  ExperienceProfile,
  Identifier,
  Maturity,
  VerificationStatus,
} from "@contracts/common";

import { slugify } from "./project";

export const CATALOG_ITEM_KINDS: CatalogItemKind[] = [
  "domain",
  "subdomain",
  "language",
  "framework",
  "library",
  "ui-system",
  "database",
  "architecture",
  "state-management",
  "testing-tool",
  "security-tool",
  "deployment",
  "cloud-service",
  "agent",
  "skill",
  "document-template",
  "mcp",
  "hook",
  "quality-gate",
];

export const CATALOG_NAME_MAX_LENGTH = 200;
export const CATALOG_DESCRIPTION_MAX_LENGTH = 5000;
export const MIN_COMPARE_ITEMS = 2;
export const MAX_COMPARE_ITEMS = 4;

// ---------------------------------------------------------------------------
// Shape guards
// ---------------------------------------------------------------------------

function isLocalizedTextShape(value: unknown): value is { en: string; tr: string } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.en === "string" && typeof candidate.tr === "string";
}

export function isCatalogItemShape(value: unknown): value is CatalogItem {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.schemaVersion === "number" &&
    typeof candidate.itemVersion === "string" &&
    typeof candidate.kind === "string" &&
    CATALOG_ITEM_KINDS.includes(candidate.kind as CatalogItemKind) &&
    typeof candidate.name === "string" &&
    typeof candidate.slug === "string" &&
    isLocalizedTextShape(candidate.shortDescription) &&
    isLocalizedTextShape(candidate.description) &&
    Array.isArray(candidate.domainIds) &&
    Array.isArray(candidate.tags) &&
    Array.isArray(candidate.supportedPlatforms) &&
    typeof candidate.difficulty === "string" &&
    typeof candidate.maturity === "string" &&
    typeof candidate.origin === "string" &&
    typeof candidate.verification === "string" &&
    Array.isArray(candidate.relations) &&
    typeof candidate.recommendation === "object" &&
    candidate.recommendation !== null &&
    typeof candidate.details === "object" &&
    candidate.details !== null &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

export function isCatalogItemListShape(value: unknown): value is CatalogItem[] {
  return Array.isArray(value) && value.every(isCatalogItemShape);
}

export interface CatalogImportPayload {
  schemaVersion: 1;
  catalogVersion: string;
  items: CatalogItem[];
}

/** Mirrors `contracts/schemas/catalog-import.schema.json`: every item must already be `origin: "user"|"imported"` and `verification: "unverified"` — an import can never create a `system`/`verified` entry (FR-018/019, AC-013). */
export function isCatalogImportPayloadShape(value: unknown): value is CatalogImportPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 1 || typeof candidate.catalogVersion !== "string") return false;
  if (!isCatalogItemListShape(candidate.items)) return false;
  return candidate.items.every(
    (item) =>
      (item.origin === "user" || item.origin === "imported") && item.verification === "unverified",
  );
}

// ---------------------------------------------------------------------------
// Search / filter / sort
// ---------------------------------------------------------------------------

export interface CatalogFilterState {
  query: string;
  kind: CatalogItemKind | "all";
  domainId: Identifier | "all";
  platform: string | "all";
  profile: ExperienceProfile | "all";
  difficulty: Difficulty | "all";
  maturity: Maturity | "all";
  origin: CatalogOrigin | "all";
  verification: VerificationStatus | "all";
}

export function defaultCatalogFilterState(): CatalogFilterState {
  return {
    query: "",
    kind: "all",
    domainId: "all",
    platform: "all",
    profile: "all",
    difficulty: "all",
    maturity: "all",
    origin: "all",
    verification: "all",
  };
}

export function hasActiveCatalogFilters(filters: CatalogFilterState): boolean {
  const defaults = defaultCatalogFilterState();
  return (Object.keys(defaults) as Array<keyof CatalogFilterState>).some(
    (key) => filters[key] !== defaults[key],
  );
}

function matchesQuery(item: CatalogItem, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = [
    item.name,
    item.shortDescription.en,
    item.shortDescription.tr,
    item.description.en,
    item.description.tr,
    ...item.tags,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(trimmed);
}

export function filterCatalogItems(
  items: CatalogItem[],
  filters: CatalogFilterState,
): CatalogItem[] {
  return items.filter((item) => {
    if (!matchesQuery(item, filters.query)) return false;
    if (filters.kind !== "all" && item.kind !== filters.kind) return false;
    if (filters.domainId !== "all" && !item.domainIds.includes(filters.domainId)) return false;
    if (filters.platform !== "all" && !item.supportedPlatforms.includes(filters.platform))
      return false;
    if (
      filters.profile !== "all" &&
      !item.recommendation.supportedProfiles.includes(filters.profile)
    ) {
      return false;
    }
    if (filters.difficulty !== "all" && item.difficulty !== filters.difficulty) return false;
    if (filters.maturity !== "all" && item.maturity !== filters.maturity) return false;
    if (filters.origin !== "all" && item.origin !== filters.origin) return false;
    if (filters.verification !== "all" && item.verification !== filters.verification) return false;
    return true;
  });
}

/** Stable order: name, then id (DATA_MODEL.md "ID and ordering rules"). */
export function sortCatalogItems(items: CatalogItem[]): CatalogItem[] {
  return [...items].sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name);
    return nameCompare !== 0 ? nameCompare : a.id.localeCompare(b.id);
  });
}

export function searchAndFilterCatalog(
  items: CatalogItem[],
  filters: CatalogFilterState,
): CatalogItem[] {
  return sortCatalogItems(filterCatalogItems(items, filters));
}

export function collectSupportedPlatforms(items: CatalogItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    for (const platform of item.supportedPlatforms) set.add(platform);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// System -> user clone (FR-020) and user CRUD (FR-019)
// ---------------------------------------------------------------------------

export interface UserCatalogItemInput {
  name: string;
  shortDescriptionEn: string;
  shortDescriptionTr: string;
  descriptionEn: string;
  descriptionTr: string;
  kind: CatalogItemKind;
  domainIds: Identifier[];
  tags: string[];
  supportedPlatforms: string[];
  difficulty: Difficulty;
}

export interface CatalogItemFieldErrors {
  name?: "required" | "tooLong";
  shortDescriptionEn?: "required" | "tooLong";
  shortDescriptionTr?: "required" | "tooLong";
  descriptionEn?: "required" | "tooLong";
  descriptionTr?: "required" | "tooLong";
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function validateUserCatalogItemInput(input: UserCatalogItemInput): CatalogItemFieldErrors {
  const errors: CatalogItemFieldErrors = {};
  if (isBlank(input.name)) errors.name = "required";
  else if (input.name.length > CATALOG_NAME_MAX_LENGTH) errors.name = "tooLong";

  if (isBlank(input.shortDescriptionEn)) errors.shortDescriptionEn = "required";
  else if (input.shortDescriptionEn.length > CATALOG_DESCRIPTION_MAX_LENGTH) {
    errors.shortDescriptionEn = "tooLong";
  }
  if (isBlank(input.shortDescriptionTr)) errors.shortDescriptionTr = "required";
  else if (input.shortDescriptionTr.length > CATALOG_DESCRIPTION_MAX_LENGTH) {
    errors.shortDescriptionTr = "tooLong";
  }
  if (isBlank(input.descriptionEn)) errors.descriptionEn = "required";
  else if (input.descriptionEn.length > CATALOG_DESCRIPTION_MAX_LENGTH)
    errors.descriptionEn = "tooLong";
  if (isBlank(input.descriptionTr)) errors.descriptionTr = "required";
  else if (input.descriptionTr.length > CATALOG_DESCRIPTION_MAX_LENGTH)
    errors.descriptionTr = "tooLong";

  return errors;
}

export function hasCatalogFieldErrors(errors: CatalogItemFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

function generateUserCatalogItemId(kind: CatalogItemKind, name: string): Identifier {
  return `user-${kind}-${slugify(name)}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Always `origin: "user"`, `verification: "unverified"` — DATA_MODEL.md: only system entries may be verified. */
export function createUserCatalogItem(
  input: UserCatalogItemInput,
  now: string = new Date().toISOString(),
): CatalogItem {
  const id = generateUserCatalogItemId(input.kind, input.name);
  return {
    id,
    schemaVersion: 1,
    itemVersion: "1.0.0",
    kind: input.kind,
    name: input.name.trim(),
    slug: slugify(input.name),
    shortDescription: { en: input.shortDescriptionEn.trim(), tr: input.shortDescriptionTr.trim() },
    description: { en: input.descriptionEn.trim(), tr: input.descriptionTr.trim() },
    domainIds: input.domainIds,
    tags: input.tags,
    supportedPlatforms: input.supportedPlatforms,
    difficulty: input.difficulty,
    maturity: "experimental",
    origin: "user",
    verification: "unverified",
    relations: [],
    recommendation: {
      supportedProfiles: ["beginner", "intermediate", "advanced", "team"],
      supportedScales: ["prototype", "mvp", "standard", "enterprise"],
      preferredDomainIds: [],
      requirementTags: [],
      baseScore: 0,
      tokenImpact: "medium",
      setupEffort: "medium",
      reasons: [],
      avoidWhen: [],
    },
    // Kind-specific `details` authoring (agent role, template path, etc.) is deferred UI scope;
    // an empty object is schema-valid (`details: {"type":"object"}` in catalog-import.schema.json).
    details: {} as never,
    createdAt: now,
    updatedAt: now,
  } as CatalogItem;
}

export function updateUserCatalogItem(
  item: CatalogItem,
  input: UserCatalogItemInput,
  now: string = new Date().toISOString(),
): CatalogItem {
  return {
    ...item,
    name: input.name.trim(),
    slug: slugify(input.name),
    shortDescription: { en: input.shortDescriptionEn.trim(), tr: input.shortDescriptionTr.trim() },
    description: { en: input.descriptionEn.trim(), tr: input.descriptionTr.trim() },
    domainIds: input.domainIds,
    tags: input.tags,
    supportedPlatforms: input.supportedPlatforms,
    difficulty: input.difficulty,
    updatedAt: now,
  };
}

/** FR-018/FR-020, AC-012: system items are read-only; cloning copies content into a new, editable user-owned entry. */
export function cloneSystemItemToUserItem(
  item: CatalogItem,
  now: string = new Date().toISOString(),
): CatalogItem {
  const id = generateUserCatalogItemId(item.kind, item.name);
  return {
    ...item,
    id,
    slug: slugify(item.name),
    origin: "user",
    verification: "unverified",
    relations: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function isSystemItem(item: CatalogItem): boolean {
  return item.origin === "system";
}

/**
 * Relations are authored on one side only (e.g. Redux declares `conflicts-with` Zustand, not the
 * reverse). Symmetric relation types (`conflicts-with`, `compatible-with`) should still apply
 * regardless of which item declared them, so callers that need "is X in a conflict with Y" check
 * both directions through this helper rather than only the item's own `relations` array. Each
 * returned relation's `targetId` always points away from `itemId` (normalized for reverse matches).
 */
export function findSymmetricRelations(
  itemId: Identifier,
  catalogItems: CatalogItem[],
  type: "conflicts-with" | "compatible-with",
): CatalogRelation[] {
  const relations: CatalogRelation[] = [];
  const item = catalogItems.find((candidate) => candidate.id === itemId);
  if (item) {
    for (const relation of item.relations) {
      if (relation.type === type) relations.push(relation);
    }
  }
  for (const candidate of catalogItems) {
    if (candidate.id === itemId) continue;
    for (const relation of candidate.relations) {
      if (relation.type === type && relation.targetId === itemId) {
        relations.push({ ...relation, targetId: candidate.id });
      }
    }
  }
  return relations;
}

// ---------------------------------------------------------------------------
// Comparison (FR-022, AC-014)
// ---------------------------------------------------------------------------

export const COMPARISON_CRITERIA = [
  "kind",
  "difficulty",
  "maturity",
  "origin",
  "verification",
  "domainIds",
  "supportedPlatforms",
  "tags",
  "license",
  "documentation",
] as const;

export type ComparisonCriterionKey = (typeof COMPARISON_CRITERIA)[number];

export function getComparisonValue(
  item: CatalogItem,
  key: ComparisonCriterionKey,
): string | undefined {
  switch (key) {
    case "kind":
      return item.kind;
    case "difficulty":
      return item.difficulty;
    case "maturity":
      return item.maturity;
    case "origin":
      return item.origin;
    case "verification":
      return item.verification;
    case "domainIds":
      return item.domainIds.length > 0 ? item.domainIds.join(", ") : undefined;
    case "supportedPlatforms":
      return item.supportedPlatforms.length > 0 ? item.supportedPlatforms.join(", ") : undefined;
    case "tags":
      return item.tags.length > 0 ? item.tags.join(", ") : undefined;
    case "license":
      return item.license;
    case "documentation":
      return item.documentation?.url ?? item.documentation?.label;
    default:
      return undefined;
  }
}

export type CompareErrorReason = "limit-reached" | "already-selected";

export type CompareAddResult =
  { ok: true; itemIds: Identifier[] } | { ok: false; reason: CompareErrorReason };

/** AC-014: a 5th comparison item is rejected with a clear, structured reason rather than silently dropped or crashing. */
export function addToComparisonSelection(
  currentIds: Identifier[],
  itemId: Identifier,
): CompareAddResult {
  if (currentIds.includes(itemId)) {
    return { ok: false, reason: "already-selected" };
  }
  if (currentIds.length >= MAX_COMPARE_ITEMS) {
    return { ok: false, reason: "limit-reached" };
  }
  return { ok: true, itemIds: [...currentIds, itemId] };
}

export function removeFromComparisonSelection(
  currentIds: Identifier[],
  itemId: Identifier,
): Identifier[] {
  return currentIds.filter((id) => id !== itemId);
}
