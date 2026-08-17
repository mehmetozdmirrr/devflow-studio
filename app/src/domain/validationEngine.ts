import type { CatalogItem } from "@contracts/catalog";
import type { Identifier, ISODateTimeString } from "@contracts/common";
import type { ProjectSelection } from "@contracts/selection";
import type { ProjectValidation, ValidationIssue, ValidationSeverity } from "@contracts/validation";

import { findSymmetricRelations } from "./catalog";

/**
 * Pure deterministic validation engine (FR-028/029, `RECOMMENDATION_AND_VALIDATION.md`
 * "Validation order"/"Severity and export policy"). Scope this phase: schema references,
 * dependency, conflict, deprecated/unverified content, and target/platform compatibility.
 * `package`/`storage`/`ai` categories are Phase 6/7 concerns (package generator, AI adapter do
 * not exist yet) and are intentionally not implemented here rather than faked.
 */

export interface ValidationEngineInput {
  selections: ProjectSelection[];
  catalogItems: CatalogItem[];
  targetPlatforms: string[];
  validatorVersion: string;
}

function buildIssueId(code: string, relatedIds: Identifier[], path?: string): Identifier {
  const sortedIds = [...relatedIds].sort((a, b) => a.localeCompare(b));
  return `issue-${code}-${sortedIds.join("+")}${path ? `-${path}` : ""}`;
}

function acceptedItems(
  selections: ProjectSelection[],
  catalogItems: CatalogItem[],
): Array<{ selection: ProjectSelection; item: CatalogItem | undefined }> {
  return selections
    .filter((selection) => selection.decision === "accepted")
    .map((selection) => ({
      selection,
      item: selection.itemId
        ? catalogItems.find((candidate) => candidate.id === selection.itemId)
        : undefined,
    }));
}

export function runValidationEngine(input: ValidationEngineInput): ProjectValidation {
  const accepted = acceptedItems(input.selections, input.catalogItems);
  const acceptedIds = new Set(accepted.map((entry) => entry.selection.itemId).filter(Boolean));
  const issuesById = new Map<Identifier, ValidationIssue>();

  function addIssue(
    issue: Omit<ValidationIssue, "id"> & { relatedIds: Identifier[] },
    path?: string,
  ): void {
    const id = buildIssueId(issue.code, issue.relatedIds, path);
    if (issuesById.has(id)) return; // de-duplicate (RECOMMENDATION_AND_VALIDATION.md "Issue identity is stable")
    issuesById.set(id, { ...issue, id, path });
  }

  for (const { selection, item } of accepted) {
    // Schema: a confirmed non-custom selection must resolve to a real catalog item.
    if (selection.itemId && selection.source !== "custom" && !item) {
      addIssue({
        code: "UNKNOWN_CATALOG_REFERENCE",
        category: "schema",
        severity: "error",
        message: `Selection references an unknown catalog item (${selection.itemId}).`,
        relatedIds: [selection.itemId],
        resolutions: [
          { action: "remove", targetId: selection.itemId, label: "Remove this selection" },
        ],
      });
      continue;
    }
    if (!item) continue;

    // Dependency: every "requires" relation must resolve to an accepted item.
    for (const relation of item.relations) {
      if (relation.type === "requires" && !acceptedIds.has(relation.targetId)) {
        const severity: ValidationSeverity = relation.severity === "error" ? "error" : "warning";
        addIssue({
          code: "MISSING_DEPENDENCY",
          category: "dependency",
          severity,
          message: `${item.name} requires ${relation.targetId}, which isn't selected.`,
          relatedIds: [item.id, relation.targetId],
          resolutions: [
            { action: "add", targetId: relation.targetId, label: "Add the required item" },
            { action: "remove", targetId: item.id, label: "Remove this selection instead" },
          ],
        });
      }
    }

    // Conflict: a hard ("error") conflict is a blocker — not resolvable by acknowledging, only by
    // removing one side. Checked symmetrically since a relation may be declared on either item;
    // `buildIssueId` sorts `relatedIds`, so both directions collapse into one de-duplicated issue.
    for (const relation of findSymmetricRelations(item.id, input.catalogItems, "conflicts-with")) {
      if (acceptedIds.has(relation.targetId)) {
        const severity: ValidationSeverity = relation.severity === "error" ? "blocker" : "warning";
        addIssue({
          code: "CONFLICTING_SELECTIONS",
          category: "conflict",
          severity,
          message: `${item.name} conflicts with a currently selected item (${relation.targetId}).`,
          relatedIds: [item.id, relation.targetId],
          resolutions: [
            { action: "remove", targetId: item.id, label: "Remove this selection" },
            {
              action: "remove",
              targetId: relation.targetId,
              label: "Remove the conflicting selection",
            },
          ],
        });
      }
    }

    // Deprecated / unverified content.
    if (item.maturity === "deprecated") {
      addIssue({
        code: "DEPRECATED_SELECTION",
        category: "deprecated",
        severity: "warning",
        message: `${item.name} is deprecated in the catalog.`,
        relatedIds: [item.id],
        resolutions: [
          { action: "replace", targetId: item.id, label: "Replace with an alternative" },
          { action: "acknowledge", label: "Acknowledge and keep" },
        ],
      });
    }
    if (item.verification === "unverified") {
      addIssue({
        code: "UNVERIFIED_CUSTOM_ITEM",
        category: "custom-content",
        severity: "info",
        message: `${item.name} is an unverified user/custom entry.`,
        relatedIds: [item.id],
        resolutions: [{ action: "acknowledge", label: "Acknowledge" }],
      });
    }

    // Target/platform compatibility.
    if (input.targetPlatforms.length > 0 && item.supportedPlatforms.length > 0) {
      const overlaps = item.supportedPlatforms.some((platform) =>
        input.targetPlatforms.includes(platform),
      );
      if (!overlaps) {
        addIssue({
          code: "UNSUPPORTED_TARGET_PLATFORM",
          category: "platform",
          severity: "warning",
          message: `${item.name} doesn't declare support for the project's target platform(s).`,
          relatedIds: [item.id],
          resolutions: [
            { action: "acknowledge", label: "Acknowledge" },
            { action: "replace", targetId: item.id, label: "Replace with an alternative" },
          ],
        });
      }
    }
  }

  const issues = [...issuesById.values()].sort((a, b) => a.id.localeCompare(b.id));
  const isValid = issues.length === 0;
  const canExport = !issues.some(
    (issue) => issue.severity === "error" || issue.severity === "blocker",
  );

  return {
    validatorVersion: input.validatorVersion,
    issues,
    isValid,
    canExport,
  };
}

/** AC-018: only info/warning issues may be acknowledged; an empty reason is rejected; error/blocker are never overridable. */
export function acknowledgeValidationIssue(
  validation: ProjectValidation,
  issueId: Identifier,
  reason: string,
  acceptedBy: string,
  now: ISODateTimeString = new Date().toISOString(),
): ProjectValidation {
  if (reason.trim().length === 0) return validation;
  return {
    ...validation,
    issues: validation.issues.map((issue) => {
      if (issue.id !== issueId) return issue;
      if (issue.severity !== "info" && issue.severity !== "warning") return issue;
      return { ...issue, override: { reason: reason.trim(), acceptedAt: now, acceptedBy } };
    }),
  };
}
