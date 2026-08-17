import { create } from "zustand";
import type {
  AIAnalysisRequest,
  AIConsent,
  AICustomCatalogProposal,
  AIErrorEnvelope,
  AIProvider,
  AIRequirementProposal,
} from "@contracts/ai";
import type { CatalogItemKind } from "@contracts/catalog";
import type { Identifier } from "@contracts/common";

import { AIRequestError } from "../adapters/aiAnalysisClient";
import { createRequirement } from "../domain/requirements";
import { addCustomSelection } from "../domain/selections";
import { AI_CONSENT_NOTICE_VERSION } from "../domain/settings";
import { selectAllCatalogItems, useCatalogStore } from "./catalogStore";
import { useProjectsStore } from "./projectsStore";
import { useRecommendationsStore } from "./recommendationsStore";

export type AIReviewCategory =
  | "clarification"
  | "requirement"
  | "catalogItem"
  | "customProposal"
  | "risk"
  | "testNeed"
  | "documentNeed";

const VALID_CATALOG_KINDS: CatalogItemKind[] = [
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

interface AIState {
  status: "idle" | "preview" | "sending" | "error";
  pendingRequest?: AIAnalysisRequest;
  lastError?: AIErrorEnvelope;
  /** projectId -> category -> key -> decision. Local review state only — the AI result itself is never mutated. */
  reviewed: Record<
    Identifier,
    Partial<Record<AIReviewCategory, Record<string, "accepted" | "rejected">>>
  >;

  buildPreview: (projectId: Identifier) => void;
  cancel: () => void;
  confirmAndSend: (projectId: Identifier, provider: AIProvider) => Promise<void>;
  dismissError: () => void;

  reviewClarification: (
    projectId: Identifier,
    questionId: string,
    decision: "accepted" | "rejected",
  ) => void;
  reviewRisk: (projectId: Identifier, risk: string, decision: "accepted" | "rejected") => void;
  reviewTestNeed: (projectId: Identifier, need: string, decision: "accepted" | "rejected") => void;
  reviewDocumentNeed: (
    projectId: Identifier,
    need: string,
    decision: "accepted" | "rejected",
  ) => void;

  acceptRequirementProposal: (
    projectId: Identifier,
    proposal: AIRequirementProposal,
  ) => Promise<void>;
  rejectRequirementProposal: (projectId: Identifier, proposal: AIRequirementProposal) => void;

  acceptCatalogRecommendation: (projectId: Identifier, itemId: Identifier) => Promise<void>;
  rejectCatalogRecommendation: (projectId: Identifier, itemId: Identifier) => void;

  acceptCustomProposal: (projectId: Identifier, proposal: AICustomCatalogProposal) => Promise<void>;
  rejectCustomProposal: (projectId: Identifier, proposal: AICustomCatalogProposal) => void;
}

function findProject(projectId: Identifier) {
  return useProjectsStore.getState().projects.find((candidate) => candidate.id === projectId);
}

function markReviewed(
  state: AIState,
  projectId: Identifier,
  category: AIReviewCategory,
  key: string,
  decision: "accepted" | "rejected",
): Pick<AIState, "reviewed"> {
  const projectReviewed = state.reviewed[projectId] ?? {};
  const categoryReviewed = projectReviewed[category] ?? {};
  return {
    reviewed: {
      ...state.reviewed,
      [projectId]: {
        ...projectReviewed,
        [category]: { ...categoryReviewed, [key]: decision },
      },
    },
  };
}

export const useAIStore = create<AIState>((set, get) => ({
  status: "idle",
  reviewed: {},

  buildPreview: (projectId) => {
    const project = findProject(projectId);
    if (!project) return;
    const catalogItems = selectAllCatalogItems(useCatalogStore.getState());
    const request: AIAnalysisRequest = {
      schemaVersion: 1,
      requestId: `analysis-${crypto.randomUUID()}`,
      locale: project.configuration.uiLanguage,
      outputLanguage: project.configuration.outputLanguage,
      consent: {
        accepted: false,
        acceptedAt: new Date(0).toISOString(),
        noticeVersion: AI_CONSENT_NOTICE_VERSION,
      },
      project: {
        idea: project.brief.idea,
        problem: project.brief.problem,
        targetUsers: project.brief.targetUsers,
        selectedDomainIds: [
          ...project.configuration.domainIds,
          ...project.configuration.customDomainIds,
        ],
        targetPlatforms: project.configuration.targetPlatforms,
        experienceProfile: project.configuration.experienceProfile,
        scale: project.configuration.projectScale,
        knownRequirements: project.requirements.map((requirement) => ({
          type: requirement.type,
          title: requirement.title,
          description: requirement.description,
          priority: requirement.priority,
        })),
      },
      catalogContext: {
        catalogVersion: "v1",
        allowedItemIds: catalogItems.map((item) => item.id),
      },
    };
    set({ status: "preview", pendingRequest: request, lastError: undefined });
  },

  cancel: () => set({ status: "idle", pendingRequest: undefined }),

  dismissError: () => set({ status: "idle", lastError: undefined }),

  confirmAndSend: async (projectId, provider) => {
    const { pendingRequest } = get();
    if (!pendingRequest) return;
    const consent: AIConsent = {
      accepted: true,
      acceptedAt: new Date().toISOString(),
      noticeVersion: AI_CONSENT_NOTICE_VERSION,
    };
    set({ status: "sending" });
    try {
      const result = await provider.analyzeProject({ ...pendingRequest, consent });
      const project = findProject(projectId);
      if (!project) return;
      useProjectsStore.getState().updateProjectDraft(projectId, {});
      useProjectsStore.setState((state) => ({
        projects: state.projects.map((candidate) =>
          candidate.id === projectId ? { ...candidate, latestAIAnalysis: result } : candidate,
        ),
      }));
      await useProjectsStore.getState().saveProjectNow(projectId);
      set({ status: "idle", pendingRequest: undefined, lastError: undefined });
    } catch (error) {
      const envelope =
        error instanceof AIRequestError
          ? error.envelope
          : ({
              schemaVersion: 1,
              requestId: pendingRequest.requestId,
              error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred.",
                retryable: true,
                fallback: "Continue with deterministic recommendations.",
              },
            } as AIErrorEnvelope);
      set({ status: "error", lastError: envelope, pendingRequest: undefined });
    }
  },

  reviewClarification: (projectId, questionId, decision) =>
    set((state) => markReviewed(state, projectId, "clarification", questionId, decision)),
  reviewRisk: (projectId, risk, decision) =>
    set((state) => markReviewed(state, projectId, "risk", risk, decision)),
  reviewTestNeed: (projectId, need, decision) =>
    set((state) => markReviewed(state, projectId, "testNeed", need, decision)),
  reviewDocumentNeed: (projectId, need, decision) =>
    set((state) => markReviewed(state, projectId, "documentNeed", need, decision)),

  acceptRequirementProposal: async (projectId, proposal) => {
    const project = findProject(projectId);
    if (!project) return;
    const requirement = {
      ...createRequirement({
        type: proposal.type,
        title: proposal.title,
        description: proposal.description,
        priority: proposal.priority,
      }),
      source: "ai-accepted" as const,
      sourceReferenceId: proposal.id,
    };
    useProjectsStore.getState().updateProjectDraft(projectId, {
      requirements: [...project.requirements, requirement],
    });
    await useProjectsStore.getState().saveProjectNow(projectId);
    set((state) => markReviewed(state, projectId, "requirement", proposal.id, "accepted"));
  },

  rejectRequirementProposal: (projectId, proposal) =>
    set((state) => markReviewed(state, projectId, "requirement", proposal.id, "rejected")),

  acceptCatalogRecommendation: async (projectId, itemId) => {
    const catalogItems = selectAllCatalogItems(useCatalogStore.getState());
    const item = catalogItems.find((candidate) => candidate.id === itemId);
    if (!item) return;
    await useRecommendationsStore.getState().acceptItem(projectId, item, "ai");
    set((state) => markReviewed(state, projectId, "catalogItem", itemId, "accepted"));
  },

  rejectCatalogRecommendation: (projectId, itemId) =>
    set((state) => markReviewed(state, projectId, "catalogItem", itemId, "rejected")),

  acceptCustomProposal: async (projectId, proposal) => {
    const project = findProject(projectId);
    if (!project) return;
    const kind = VALID_CATALOG_KINDS.includes(proposal.kind as CatalogItemKind)
      ? (proposal.kind as CatalogItemKind)
      : "library";
    const selections = addCustomSelection(project.selections, projectId, {
      name: proposal.name,
      kind,
    });
    useProjectsStore.getState().updateProjectDraft(projectId, { selections });
    await useProjectsStore.getState().saveProjectNow(projectId);
    set((state) => markReviewed(state, projectId, "customProposal", proposal.name, "accepted"));
  },

  rejectCustomProposal: (projectId, proposal) =>
    set((state) => markReviewed(state, projectId, "customProposal", proposal.name, "rejected")),
}));
