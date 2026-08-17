import type { CatalogItem } from "@contracts/catalog";
import type { Identifier } from "@contracts/common";
import type { ProjectSelection, SelectionSource } from "@contracts/selection";

/**
 * Pure `ProjectSelection` reducers (FR-026/027, RECOMMENDATION_AND_VALIDATION.md "User decision
 * behavior"). Every function returns a new array; nothing here touches storage or React state —
 * callers (`application/*Store.ts`) decide when a user action justifies calling one of these and
 * persist the result explicitly. A selection is unique per `itemId` within a project: accepting,
 * removing, or replacing an item updates its existing record in place instead of duplicating it,
 * so "removed stays removed until restored" (AC-016) has one authoritative record to check.
 */

function generateSelectionId(): Identifier {
  return `selection-${crypto.randomUUID()}`;
}

export function buildCatalogSnapshot(item: CatalogItem): ProjectSelection["snapshot"] {
  return {
    itemId: item.id,
    itemVersion: item.itemVersion,
    name: item.name,
    kind: item.kind,
    verification: item.verification,
  };
}

function upsertByItemId(
  selections: ProjectSelection[],
  itemId: Identifier | undefined,
  build: (existing: ProjectSelection | undefined) => ProjectSelection,
): ProjectSelection[] {
  if (itemId === undefined) {
    return [...selections, build(undefined)];
  }
  const index = selections.findIndex((selection) => selection.itemId === itemId);
  if (index === -1) {
    return [...selections, build(undefined)];
  }
  return selections.map((selection, position) =>
    position === index ? build(selection) : selection,
  );
}

export interface AcceptSelectionOptions {
  sourceRuleIds?: Identifier[];
  sourceAnalysisId?: Identifier;
  requiredBySelectionIds?: Identifier[];
}

/** Accept/confirm a catalog item for the project — always an explicit, user-triggered call. */
export function acceptCatalogSelection(
  selections: ProjectSelection[],
  projectId: Identifier,
  item: CatalogItem,
  source: SelectionSource,
  now: string = new Date().toISOString(),
  options: AcceptSelectionOptions = {},
): ProjectSelection[] {
  return upsertByItemId(selections, item.id, (existing) => ({
    id: existing?.id ?? generateSelectionId(),
    projectId,
    itemId: item.id,
    snapshot: buildCatalogSnapshot(item),
    source,
    decision: "accepted",
    sourceRuleIds: options.sourceRuleIds ?? existing?.sourceRuleIds ?? [],
    sourceAnalysisId: options.sourceAnalysisId ?? existing?.sourceAnalysisId,
    requiredBySelectionIds:
      options.requiredBySelectionIds ?? existing?.requiredBySelectionIds ?? [],
    warningOverrideIds: existing?.warningOverrideIds ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }));
}

/**
 * Marks an item removed. This still writes a record (source/snapshot preserved or taken from
 * `item`) so a later recommendation re-run can see "the user already decided against this" and
 * never silently restore it (AC-016).
 */
export function removeCatalogSelection(
  selections: ProjectSelection[],
  projectId: Identifier,
  item: CatalogItem,
  source: SelectionSource,
  now: string = new Date().toISOString(),
): ProjectSelection[] {
  return upsertByItemId(selections, item.id, (existing) => ({
    id: existing?.id ?? generateSelectionId(),
    projectId,
    itemId: item.id,
    snapshot: buildCatalogSnapshot(item),
    source: existing?.source ?? source,
    decision: "removed",
    sourceRuleIds: existing?.sourceRuleIds ?? [],
    sourceAnalysisId: existing?.sourceAnalysisId,
    requiredBySelectionIds: existing?.requiredBySelectionIds ?? [],
    warningOverrideIds: existing?.warningOverrideIds ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }));
}

export function isItemRemoved(selections: ProjectSelection[], itemId: Identifier): boolean {
  return selections.some(
    (selection) => selection.itemId === itemId && selection.decision === "removed",
  );
}

export function isItemAccepted(selections: ProjectSelection[], itemId: Identifier): boolean {
  return selections.some(
    (selection) => selection.itemId === itemId && selection.decision === "accepted",
  );
}

/** Removes `oldItem`, accepts `newItem` as an explicit manual substitution (FR-026 "replace"). */
export function replaceCatalogSelection(
  selections: ProjectSelection[],
  projectId: Identifier,
  oldItem: CatalogItem,
  newItem: CatalogItem,
  now: string = new Date().toISOString(),
): ProjectSelection[] {
  const withRemoved = removeCatalogSelection(selections, projectId, oldItem, "manual", now);
  return acceptCatalogSelection(withRemoved, projectId, newItem, "manual", now);
}

export interface CustomSelectionInput {
  name: string;
  kind: ProjectSelection["snapshot"]["kind"];
}

export function validateCustomSelectionInput(input: CustomSelectionInput): "required" | undefined {
  return input.name.trim().length === 0 ? "required" : undefined;
}

/** Custom/manual snapshot with no catalog `itemId` (FR-026 "manually add"); always unverified. */
export function addCustomSelection(
  selections: ProjectSelection[],
  projectId: Identifier,
  input: CustomSelectionInput,
  now: string = new Date().toISOString(),
): ProjectSelection[] {
  const selection: ProjectSelection = {
    id: generateSelectionId(),
    projectId,
    snapshot: {
      itemId: `custom-${crypto.randomUUID()}`,
      itemVersion: "1.0.0",
      name: input.name.trim(),
      kind: input.kind,
      verification: "unverified",
    },
    source: "custom",
    decision: "accepted",
    sourceRuleIds: [],
    requiredBySelectionIds: [],
    warningOverrideIds: [],
    createdAt: now,
    updatedAt: now,
  };
  return [...selections, selection];
}

/** Detaches a selection from the project entirely (distinct from "removed" — used only for accidental custom-entry cleanup, not for recommendation candidates). */
export function deleteSelection(
  selections: ProjectSelection[],
  selectionId: Identifier,
): ProjectSelection[] {
  return selections.filter((selection) => selection.id !== selectionId);
}

export function acknowledgeSelectionWarning(
  selections: ProjectSelection[],
  itemId: Identifier,
  issueId: Identifier,
  now: string = new Date().toISOString(),
): ProjectSelection[] {
  return selections.map((selection) => {
    if (selection.itemId !== itemId || selection.warningOverrideIds.includes(issueId))
      return selection;
    return {
      ...selection,
      warningOverrideIds: [...selection.warningOverrideIds, issueId],
      updatedAt: now,
    };
  });
}
