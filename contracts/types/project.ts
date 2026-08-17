import type {
  AuditTimestamps,
  ExecutionProfile,
  ExperienceProfile,
  Identifier,
  Locale,
  ProjectScale,
  SelectionMode,
} from "./common";
import type { AIAnalysisResult } from "./ai";
import type { PackageSettings } from "./package";
import type { Requirement } from "./requirement";
import type { ProjectSelection } from "./selection";
import type { ProjectValidation } from "./validation";

export type ProjectStatus =
  | "draft"
  | "configured"
  | "validated"
  | "generated"
  | "archived"
  | "trashed";

export interface ProjectMeta {
  name: string;
  slug: string;
  owner?: string;
  tags: string[];
}

export interface ProjectBrief {
  idea: string;
  problem: string;
  proposedSolution: string;
  targetUsers: string[];
  goals: string[];
  successMeasures: string[];
  constraints: string[];
  notes?: string;
}

export interface ProjectConfiguration {
  experienceProfile: ExperienceProfile;
  projectScale: ProjectScale;
  selectionMode: SelectionMode;
  executionProfile: ExecutionProfile;
  uiLanguage: Locale;
  outputLanguage: Locale;
  domainIds: Identifier[];
  customDomainIds: Identifier[];
  customDomainLabels: Record<Identifier, string>;
  targetPlatforms: string[];
  connectivity: "online" | "offline" | "hybrid";
  userModel: "single-user" | "multi-user";
  dataSensitivity: string[];
  enabledCapabilities: string[];
  forbiddenTechnologies: string[];
}

export interface Project extends AuditTimestamps {
  id: Identifier;
  schemaVersion: number;
  revision: number;
  meta: ProjectMeta;
  brief: ProjectBrief;
  configuration: ProjectConfiguration;
  requirements: Requirement[];
  selections: ProjectSelection[];
  latestAIAnalysis?: AIAnalysisResult;
  packageSettings: PackageSettings;
  validation: ProjectValidation;
  status: ProjectStatus;
  archivedAt?: string;
  trashedAt?: string;
}

