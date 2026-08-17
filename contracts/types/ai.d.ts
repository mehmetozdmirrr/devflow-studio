import type { ExperienceProfile, Identifier, ISODateTimeString, Locale, ProjectScale } from "./common";
import type { RequirementPriority, RequirementType } from "./requirement";
export interface AIConsent {
    accepted: boolean;
    acceptedAt: ISODateTimeString;
    noticeVersion: string;
}
export interface AIAnalysisRequest {
    schemaVersion: 1;
    requestId: Identifier;
    locale: Locale;
    outputLanguage: Locale;
    consent: AIConsent;
    project: {
        idea: string;
        problem: string;
        targetUsers: string[];
        selectedDomainIds: Identifier[];
        targetPlatforms: string[];
        experienceProfile: ExperienceProfile;
        scale: ProjectScale;
        knownRequirements: Array<{
            type: RequirementType;
            title: string;
            description: string;
            priority: RequirementPriority;
        }>;
    };
    catalogContext: {
        catalogVersion: string;
        allowedItemIds: Identifier[];
    };
}
export interface AIClarificationQuestion {
    id: Identifier;
    question: string;
    reason: string;
    affects: Array<"scope" | "stack" | "architecture" | "security" | "testing">;
    requiredBeforeGeneration: boolean;
}
export interface AIRequirementProposal {
    id: Identifier;
    type: RequirementType;
    title: string;
    description: string;
    priority: RequirementPriority;
    reason: string;
}
export interface AICustomCatalogProposal {
    name: string;
    kind: string;
    reason: string;
    documentationUrl?: string;
    verification: "unverified";
}
export interface AIAnalysisResult {
    schemaVersion: 1;
    requestId: Identifier;
    analysisId: Identifier;
    analyzedAt?: ISODateTimeString;
    classification: {
        domainIds: Identifier[];
        complexity: "prototype" | "standard" | "complex";
        confidence: number;
    };
    clarificationQuestions: AIClarificationQuestion[];
    proposedRequirements: AIRequirementProposal[];
    recommendedItemIds: Identifier[];
    customProposals: AICustomCatalogProposal[];
    risks: string[];
    testNeeds: string[];
    documentNeeds: string[];
    warnings: string[];
}
export type AIErrorCode = "INVALID_REQUEST" | "CONSENT_REQUIRED" | "PAYLOAD_TOO_LARGE" | "ORIGIN_NOT_ALLOWED" | "AI_DISABLED" | "AI_RATE_LIMITED" | "AI_TIMEOUT" | "AI_PROVIDER_ERROR" | "AI_INVALID_OUTPUT" | "INTERNAL_ERROR";
export interface AIErrorEnvelope {
    schemaVersion: 1;
    requestId: Identifier;
    error: {
        code: AIErrorCode;
        message: string;
        retryable: boolean;
        fallback: string;
    };
}
export interface AIProvider {
    analyzeProject(request: AIAnalysisRequest): Promise<AIAnalysisResult>;
}
