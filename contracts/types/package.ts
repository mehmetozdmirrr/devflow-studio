import type { Identifier, ISODateTimeString, Locale } from "./common";
import type { CatalogItemSnapshot } from "./selection";
import type { ValidationIssue } from "./validation";

export interface PackageSettings {
  outputLanguage: Locale;
  includeClaudeMd: boolean;
  includeProjectConfig: boolean;
  includeAgents: boolean;
  includeSkills: boolean;
  includeDocuments: boolean;
  includeTaskFiles: boolean;
  includeSafeSettings: boolean;
  includeHooks: boolean;
  includeMcpRecommendations: boolean;
  excludedOptionalPaths: string[];
  textOverrides: Record<string, string>;
}

export type GeneratedFileSource =
  | "core"
  | "template"
  | "catalog-item"
  | "user-override";

export interface GeneratedFile {
  path: string;
  mediaType: "text/markdown" | "application/json" | "text/plain";
  encoding: "utf-8";
  content: string;
  contentHash: string;
  source: GeneratedFileSource;
  sourceId?: Identifier;
  inclusionReason: string;
  required: boolean;
  editable: boolean;
  excludable: boolean;
}

export interface ManifestFileEntry {
  path: string;
  mediaType: GeneratedFile["mediaType"];
  contentHash: string;
  source: GeneratedFileSource;
  sourceId?: Identifier;
  inclusionReason: string;
}

export interface PackageManifest {
  schemaVersion: 1;
  generatorVersion: string;
  projectId: Identifier;
  projectRevision: number;
  catalogVersion: string;
  ruleSetVersion: string;
  templateSetVersion: string;
  outputLanguage: Locale;
  selectedItems: CatalogItemSnapshot[];
  files: ManifestFileEntry[];
  warnings: ValidationIssue[];
  generatedAt?: ISODateTimeString;
}

export interface PackageBuildResult {
  manifest: PackageManifest;
  files: GeneratedFile[];
  issues: ValidationIssue[];
  canExport: boolean;
}

export interface PackageGenerator {
  generate(projectId: Identifier, settings: PackageSettings): Promise<PackageBuildResult>;
}

