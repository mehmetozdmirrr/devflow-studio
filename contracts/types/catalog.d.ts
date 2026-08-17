import type { AuditTimestamps, CatalogOrigin, Difficulty, EffortLevel, ExperienceProfile, Identifier, LocalizedText, Maturity, ProjectScale, SourceReference, TokenImpact, VerificationStatus } from "./common";
export type CatalogItemKind = "domain" | "subdomain" | "language" | "framework" | "library" | "ui-system" | "database" | "architecture" | "state-management" | "testing-tool" | "security-tool" | "deployment" | "cloud-service" | "agent" | "skill" | "document-template" | "mcp" | "hook" | "quality-gate";
export type CatalogRelationType = "requires" | "recommends" | "compatible-with" | "conflicts-with" | "replaces";
export interface CatalogRelation {
    type: CatalogRelationType;
    targetId: Identifier;
    reason: LocalizedText;
    severity: "info" | "warning" | "error";
}
export interface RecommendationMetadata {
    supportedProfiles: ExperienceProfile[];
    supportedScales: ProjectScale[];
    preferredDomainIds: Identifier[];
    requirementTags: string[];
    baseScore: number;
    tokenImpact: TokenImpact;
    setupEffort: EffortLevel;
    reasons: LocalizedText[];
    avoidWhen: LocalizedText[];
}
export interface DomainDetails {
    parentDomainId?: Identifier;
    defaultQuestionSetIds: Identifier[];
}
export interface TechnologyDetails {
    packageName?: string;
    currentMajorVersion?: string;
    runtimeRequirements: string[];
    installationNotes?: LocalizedText;
}
export interface ArchitectureDetails {
    suitableFor: string[];
    tradeoffs: LocalizedText[];
    requiredDocumentIds: Identifier[];
}
export interface AgentDetails {
    role: LocalizedText;
    responsibilities: LocalizedText[];
    allowedToolCategories: string[];
    forbiddenActions: string[];
    outputContract: string[];
    contentTemplateId: Identifier;
}
export interface SkillDetails {
    invocationMode: "automatic" | "manual" | "both";
    contentTemplateId: Identifier;
    supportingFileIds: Identifier[];
    estimatedContextSize: "small" | "medium" | "large";
}
export interface DocumentTemplateDetails {
    outputPathTemplate: string;
    templateId: Identifier;
    requiredVariables: string[];
    generatedLanguageSupport: Array<"tr" | "en">;
    optional: boolean;
}
export interface IntegrationDetails {
    integrationType: "api" | "mcp" | "hook" | "deployment" | "cloud" | "other";
    secretRequired: boolean;
    defaultEnabled: false;
    reviewChecklistIds: Identifier[];
}
export interface QualityGateDetails {
    commandCapability: string;
    blocksRelease: boolean;
    evidenceType: string;
}
export interface GenericDetails {
    attributes: Record<string, string | number | boolean | string[]>;
}
export interface CatalogItemDetailsMap {
    domain: DomainDetails;
    subdomain: DomainDetails;
    language: TechnologyDetails;
    framework: TechnologyDetails;
    library: TechnologyDetails;
    "ui-system": TechnologyDetails;
    database: TechnologyDetails;
    architecture: ArchitectureDetails;
    "state-management": TechnologyDetails;
    "testing-tool": TechnologyDetails;
    "security-tool": TechnologyDetails;
    deployment: IntegrationDetails;
    "cloud-service": IntegrationDetails;
    agent: AgentDetails;
    skill: SkillDetails;
    "document-template": DocumentTemplateDetails;
    mcp: IntegrationDetails;
    hook: IntegrationDetails;
    "quality-gate": QualityGateDetails;
}
export interface CatalogItemBase<K extends CatalogItemKind, D> extends AuditTimestamps {
    id: Identifier;
    schemaVersion: number;
    itemVersion: string;
    kind: K;
    name: string;
    slug: string;
    shortDescription: LocalizedText;
    description: LocalizedText;
    domainIds: Identifier[];
    tags: string[];
    supportedPlatforms: string[];
    difficulty: Difficulty;
    maturity: Maturity;
    origin: CatalogOrigin;
    verification: VerificationStatus;
    relations: CatalogRelation[];
    recommendation: RecommendationMetadata;
    documentation?: SourceReference;
    license?: string;
    details: D;
}
export type CatalogItem = {
    [K in CatalogItemKind]: CatalogItemBase<K, CatalogItemDetailsMap[K]>;
}[CatalogItemKind];
export interface CatalogManifest {
    schemaVersion: number;
    catalogVersion: string;
    generatedAt: string;
    itemCount: number;
    items: CatalogItem[];
}
