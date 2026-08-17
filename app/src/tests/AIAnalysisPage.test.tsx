import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIAnalysisResult } from "@contracts/ai";

import { AIAnalysisPage } from "../pages/AIAnalysisPage";
import { useProjectsStore } from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import { useCatalogStore } from "../application/catalogStore";
import { useAIStore } from "../application/aiStore";
import { defaultCatalogFilterState } from "../domain/catalog";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { createDraftProject } from "../domain/project";
import { SYSTEM_CATALOG_ITEMS } from "../catalog/systemCatalog";
import { HttpAIAnalysisClient } from "../adapters/aiAnalysisClient";

vi.mock("../adapters/aiAnalysisClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../adapters/aiAnalysisClient")>();
  return {
    ...actual,
    HttpAIAnalysisClient: vi.fn().mockImplementation(() => ({
      analyzeProject: vi.fn(),
    })),
  };
});

function resetStores(aiEnabled: boolean): void {
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
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, enabled: aiEnabled } },
    hydrated: true,
    undoSnapshot: null,
  });
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
  useAIStore.setState({
    status: "idle",
    pendingRequest: undefined,
    lastError: undefined,
    reviewed: {},
  });
}

function seedProject(name = "AI Page Test Project") {
  const project = createDraftProject(
    {
      name,
      idea: "idea",
      problem: "problem",
      proposedSolution: "solution",
      experienceProfile: "beginner",
    },
    useSettingsStore.getState().settings,
  );
  useProjectsStore.setState((state) => ({ projects: [...state.projects, project] }));
  return project;
}

function renderPage(projectId: string) {
  return render(
    <MemoryRouter initialEntries={[`/projects/${projectId}/ai`]}>
      <Routes>
        <Route path="/projects/:projectId/ai" element={<AIAnalysisPage />} />
        <Route path="/settings" element={<div data-testid="navigated-to-settings" />} />
      </Routes>
    </MemoryRouter>,
  );
}

function analysisResult(overrides: Partial<AIAnalysisResult> = {}): AIAnalysisResult {
  return {
    schemaVersion: 1,
    requestId: "request-1",
    analysisId: "analysis-1",
    classification: { domainIds: ["domain-web"], complexity: "standard", confidence: 0.8 },
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

beforeEach(() => {
  resetStores(true);
  vi.clearAllMocks();
});

describe("AIAnalysisPage (FR-030–036)", () => {
  it("shows a not-found state for an unknown project id", () => {
    renderPage("does-not-exist");
    expect(screen.getByText("This project doesn't exist or was removed.")).toBeInTheDocument();
  });

  it("shows a disabled state with a link to Settings when AI is not enabled", async () => {
    resetStores(false);
    const project = seedProject();
    renderPage(project.id);

    expect(
      screen.getByText(/AI analysis is turned off\. Enable it in Settings first/),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "Go to Settings" }));
    expect(screen.getByTestId("navigated-to-settings")).toBeInTheDocument();
  });

  it("shows the consent notice before sending, and only sends after explicit confirmation", async () => {
    const project = seedProject();
    renderPage(project.id);

    expect(screen.getByText(/Sending this request shares your project idea/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Start AI analysis" }));
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("cancel returns to the consent screen without sending anything", async () => {
    const project = seedProject();
    renderPage(project.id);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Start AI analysis" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Start AI analysis" })).toBeInTheDocument();
    expect(useProjectsStore.getState().projects[0].latestAIAnalysis).toBeUndefined();
  });

  it("renders review sections with accept/reject actions after a successful send", async () => {
    const mockedClient = vi.mocked(HttpAIAnalysisClient);
    mockedClient.mockImplementation(function () {
      return {
        analyzeProject: vi.fn().mockResolvedValue(
          analysisResult({
            risks: ["Third-party API instability"],
          }),
        ),
      } as unknown as HttpAIAnalysisClient;
    });

    const project = seedProject();
    renderPage(project.id);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Start AI analysis" }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText("Risks")).toBeInTheDocument());
    expect(screen.getByText("Third-party API instability")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Accept" })[0]);
    await waitFor(() => expect(screen.getByText("Accepted")).toBeInTheDocument());
  });

  it("renders the error message and fallback on failure, with retry and dismiss", async () => {
    const mockedClient = vi.mocked(HttpAIAnalysisClient);
    mockedClient.mockImplementation(function () {
      return {
        analyzeProject: vi.fn().mockRejectedValue(new Error("network down")),
      } as unknown as HttpAIAnalysisClient;
    });

    const project = seedProject();
    renderPage(project.id);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Start AI analysis" }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument(),
    );
    expect(screen.getByText("Continue with deterministic recommendations.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.getByRole("button", { name: "Start AI analysis" })).toBeInTheDocument();
  });
});
