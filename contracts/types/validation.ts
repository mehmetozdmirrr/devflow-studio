import type { Identifier, ISODateTimeString } from "./common";

export type ValidationSeverity = "info" | "warning" | "error" | "blocker";
export type ValidationCategory =
  | "schema"
  | "dependency"
  | "conflict"
  | "deprecated"
  | "platform"
  | "security"
  | "privacy"
  | "storage"
  | "ai"
  | "package"
  | "custom-content";

export interface ValidationResolution {
  action: "add" | "remove" | "replace" | "edit" | "acknowledge" | "retry";
  targetId?: Identifier;
  label: string;
}

export interface ValidationOverride {
  reason: string;
  acceptedAt: ISODateTimeString;
  acceptedBy: string;
}

export interface ValidationIssue {
  id: Identifier;
  code: string;
  category: ValidationCategory;
  severity: ValidationSeverity;
  message: string;
  path?: string;
  relatedIds: Identifier[];
  ruleId?: Identifier;
  resolutions: ValidationResolution[];
  override?: ValidationOverride;
}

export interface ProjectValidation {
  validatedAt?: ISODateTimeString;
  validatorVersion: string;
  issues: ValidationIssue[];
  isValid: boolean;
  canExport: boolean;
}

