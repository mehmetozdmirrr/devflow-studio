import { beforeEach, describe, expect, it } from "vitest";
import type { AIAnalysisResult, AIErrorEnvelope, AIProvider } from "@contracts/ai";

import { useAIStore } from "../application/aiStore";
import { useCatalogStore } from "../application/catalogStore";
import { useProjectsStore } from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { defaultCatalogFilterState } from "../domain/catalog";
import { createDraftProject } from "../domain/project";
import { SYSTEM_CATALOG_ITEMS } from "../catalog/systemCatalog";
import { AIRequestError } from "../adapters/aiAnalysisClient";

const typescriptItem = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "language-typescript")!;

function resetStores(): void {
  useCatalogStore.setState({
    systemItems: SYSTEM_CATALOG_ITEMS,
    userItems: [],
    hydrated: true,
    loadError: null,
    filters: defaultCatalogFilterState(),
    selectedItemId: null,
    compareItemIds: [],
    compareError: null,
  });
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, enabled: true } },
    hydrated: true,
    undoSnapshot: null,
  });
  useProjectsStore.setState({
    projects: [],
    hydrated: true,
    loadError: null,
    dirtyProjectIds: new Set(),
    saveErrorsByProjectId: {},
    trashUndo: null,
    searchQuery: "",
    statusFilter: "all",
    sortBy: "updatedAt",
  });
  useAIStore.setState({
    status: "idle",
    pendingRequest: undefined,
    lastError: undefined,
    reviewed: {},
  });
}

function seedProject() {
  const project = createDraftProject(
    {
      name: "AI Test Project",
      idea: "idea",
      problem: "problem",
      proposedSolution: "solution",
      experienceProfile: "beginner",
    },
    useSettingsStore.getState().settings,
  );
  useProjectsStore.setState({ projects: [project] });
  return project;
}

function currentProject(id: string) {
  return useProjectsStore.getState().projects.find((p) => p.id === id)!;
}

function validResult(overrides: Partial<AIAnalysisResult> = {}): AIAnalysisResult {
  return {
    schemaVersion: 1,
    requestId: "request-1",
    analysisId: "analysis-1",
    classification: { domainIds: ["domain-web"], complexity: "standard", confidence: 0.7 },
    clarificationQuestions: [],
    proposedRequirements: [],
    recommendedItemIds: [],
    customProposals: [],
    risks: [],
    testNeeds: [],
    documentNeeds: [],
    warnings: [],
    ...overrides,
  };
}

function fakeProvider(result: AIAnalysisResult): AIProvider {
  return { analyzeProject: async () => result };
}

function failingProvider(envelope: AIErrorEnvelope): AIProvider {
  return {
    analyzeProject: async () => {
      throw new AIRequestError(envelope);
    },
  };
}

beforeEach(() => {
  resetStores();
});

describe("useAIStore (FR-030–036)", () => {
  it("buildPreview moves status to preview without recording consent yet", () => {
    const project = seedProject();
    useAIStore.getState().buildPreview(project.id);
    const state = useAIStore.getState();
    expect(state.status).toBe("preview");
    expect(state.pendingRequest?.consent.accepted).toBe(false);
  });

  it("cancel returns to idle and clears the pending request", () => {
    const project = seedProject();
    useAIStore.getState().buildPreview(project.id);
    useAIStore.getState().cancel();
    const state = useAIStore.getState();
    expect(state.status).toBe("idle");
    expect(state.pendingRequest).toBeUndefined();
  });

  it("confirmAndSend stores the result on the project and returns to idle on success", async () => {
    const project = seedProject();
    useAIStore.getState().buildPreview(project.id);
    await useAIStore.getState().confirmAndSend(project.id, fakeProvider(validResult()));

    const state = useAIStore.getState();
    expect(state.status).toBe("idle");
    expect(state.lastError).toBeUndefined();
    expect(currentProject(project.id).latestAIAnalysis?.analysisId).toBe("analysis-1");
  });

  it("confirmAndSend does nothing when there is no pending request (never sends without buildPreview + explicit send)", async () => {
    const project = seedProject();
    await useAIStore.getState().confirmAndSend(project.id, fakeProvider(validResult()));
    expect(currentProject(project.id).latestAIAnalysis).toBeUndefined();
  });

  it("confirmAndSend surfaces the provider's error envelope and preserves the deterministic project state (FR-034)", async () => {
    const project = seedProject();
    const envelope: AIErrorEnvelope = {
      schemaVersion: 1,
      requestId: "request-1",
      error: {
        code: "AI_TIMEOUT",
        message: "AI analysis timed out.",
        retryable: true,
        fallback: "Continue with deterministic recommendations.",
      },
    };
    useAIStore.getState().buildPreview(project.id);
    await useAIStore.getState().confirmAndSend(project.id, failingProvider(envelope));

    const state = useAIStore.getState();
    expect(state.status).toBe("error");
    expect(state.lastError?.error.code).toBe("AI_TIMEOUT");
    expect(currentProject(project.id).latestAIAnalysis).toBeUndefined();
  });

  it("dismissError clears the error and returns to idle", async () => {
    const project = seedProject();
    useAIStore.getState().buildPreview(project.id);
    await useAIStore.getState().confirmAndSend(
      project.id,
      failingProvider({
        schemaVersion: 1,
        requestId: "request-1",
        error: { code: "AI_PROVIDER_ERROR", message: "x", retryable: true, fallback: "y" },
      }),
    );
    useAIStore.getState().dismissError();
    const state = useAIStore.getState();
    expect(state.status).toBe("idle");
    expect(state.lastError).toBeUndefined();
  });

  it("reviewClarification/reviewRisk/reviewTestNeed/reviewDocumentNeed record a local decision without touching the project", () => {
    const project = seedProject();
    useAIStore.getState().reviewClarification(project.id, "q-1", "accepted");
    useAIStore.getState().reviewRisk(project.id, "risk text", "rejected");
    useAIStore.getState().reviewTestNeed(project.id, "test need", "accepted");
    useAIStore.getState().reviewDocumentNeed(project.id, "doc need", "rejected");

    const reviewed = useAIStore.getState().reviewed[project.id];
    expect(reviewed?.clarification?.["q-1"]).toBe("accepted");
    expect(reviewed?.risk?.["risk text"]).toBe("rejected");
    expect(reviewed?.testNeed?.["test need"]).toBe("accepted");
    expect(reviewed?.documentNeed?.["doc need"]).toBe("rejected");
    expect(currentProject(project.id).requirements).toHaveLength(0);
  });

  it("acceptRequirementProposal adds a real requirement marked ai-accepted; rejectRequirementProposal never touches the project", async () => {
    const project = seedProject();
    const proposal = {
      id: "proposal-1",
      type: "functional" as const,
      title: "Support offline mode",
      description: "Allow the app to work without a network connection.",
      priority: "should" as const,
      reason: "Users may work in low-connectivity environments.",
    };

    await useAIStore.getState().acceptRequirementProposal(project.id, proposal);
    let updated = currentProject(project.id);
    expect(updated.requirements).toHaveLength(1);
    expect(updated.requirements[0].source).toBe("ai-accepted");
    expect(useAIStore.getState().reviewed[project.id]?.requirement?.[proposal.id]).toBe("accepted");

    useAIStore.getState().rejectRequirementProposal(project.id, { ...proposal, id: "proposal-2" });
    updated = currentProject(project.id);
    expect(updated.requirements).toHaveLength(1);
    expect(useAIStore.getState().reviewed[project.id]?.requirement?.["proposal-2"]).toBe(
      "rejected",
    );
  });

  it("acceptCatalogRecommendation adds an accepted selection sourced as ai; rejectCatalogRecommendation never touches selections", async () => {
    const project = seedProject();
    await useAIStore.getState().acceptCatalogRecommendation(project.id, typescriptItem.id);
    let updated = currentProject(project.id);
    const accepted = updated.selections.find(
      (selection) => selection.itemId === typescriptItem.id && selection.decision === "accepted",
    );
    expect(accepted?.source).toBe("ai");

    useAIStore.getState().rejectCatalogRecommendation(project.id, "unknown-item-id");
    updated = currentProject(project.id);
    expect(updated.selections.some((selection) => selection.itemId === "unknown-item-id")).toBe(
      false,
    );
  });

  it("acceptCustomProposal adds an unverified custom selection; rejectCustomProposal never touches selections", async () => {
    const project = seedProject();
    const proposal = {
      name: "Some New Tool",
      kind: "library",
      reason: "reason",
      verification: "unverified" as const,
    };

    await useAIStore.getState().acceptCustomProposal(project.id, proposal);
    let updated = currentProject(project.id);
    expect(
      updated.selections.some((selection) => selection.snapshot.name === "Some New Tool"),
    ).toBe(true);

    useAIStore.getState().rejectCustomProposal(project.id, { ...proposal, name: "Another Tool" });
    updated = currentProject(project.id);
    expect(updated.selections.some((selection) => selection.snapshot.name === "Another Tool")).toBe(
      false,
    );
  });
});
