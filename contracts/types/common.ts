export type ISODateTimeString = string;
export type Locale = "tr" | "en";
export type Identifier = string;

export type ExperienceProfile =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "team";

export type ProjectScale =
  | "prototype"
  | "mvp"
  | "standard"
  | "enterprise";

export type SelectionMode = "automatic" | "guided" | "manual";
export type ExecutionProfile = "economic" | "balanced" | "comprehensive";
export type ThemeMode = "light" | "dark" | "system";

export type CatalogOrigin = "system" | "user" | "imported";
export type VerificationStatus = "verified" | "unverified";
export type Maturity = "stable" | "preview" | "experimental" | "deprecated";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type TokenImpact = "low" | "medium" | "high";
export type EffortLevel = "low" | "medium" | "high";

export interface VersionRef {
  schemaVersion: number;
  contentVersion: string;
}

export interface LocalizedText {
  en: string;
  tr: string;
}

export interface AuditTimestamps {
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface SourceReference {
  label: string;
  url?: string;
  reviewedAt?: ISODateTimeString;
}

