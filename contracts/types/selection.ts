import type {
  AuditTimestamps,
  Identifier,
  VerificationStatus,
} from "./common";
import type { CatalogItemKind } from "./catalog";

export type SelectionSource =
  | "required"
  | "deterministic"
  | "manual"
  | "custom"
  | "ai";

export type SelectionDecision = "pending" | "accepted" | "rejected" | "removed";

export interface CatalogItemSnapshot {
  itemId: Identifier;
  itemVersion: string;
  name: string;
  kind: CatalogItemKind;
  verification: VerificationStatus;
}

export interface ProjectSelection extends AuditTimestamps {
  id: Identifier;
  projectId: Identifier;
  itemId?: Identifier;
  snapshot: CatalogItemSnapshot;
  source: SelectionSource;
  decision: SelectionDecision;
  sourceRuleIds: Identifier[];
  sourceAnalysisId?: Identifier;
  requiredBySelectionIds: Identifier[];
  userReason?: string;
  warningOverrideIds: Identifier[];
}

