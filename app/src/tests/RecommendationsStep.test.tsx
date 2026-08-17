import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecommendationsStep } from "../pages/wizard/steps/RecommendationsStep";
import { useCatalogStore } from "../application/catalogStore";
import { useProjectsStore } from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { defaultCatalogFilterState } from "../domain/catalog";
import { acceptCatalogSelection } from "../domain/selections";
import { createDraftProject } from "../domain/project";
import { SYSTEM_CATALOG_ITEMS } from "../catalog/systemCatalog";

const jestItem = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "testing-tool-jest")!;
const vitestItem = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "testing-tool-vitest")!;

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
    settings: { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai } },
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
}

function seedProject(domainIds: string[] = ["domain-web"]) {
  const project = createDraftProject(
    {
      name: "Test",
      idea: "idea",
      problem: "problem",
      proposedSolution: "solution",
      experienceProfile: "beginner",
    },
    useSettingsStore.getState().settings,
  );
  project.configuration.domainIds = domainIds;
  useProjectsStore.setState({ projects: [project] });
  return project;
}

function currentProject(id: string) {
  return useProjectsStore.getState().projects.find((p) => p.id === id)!;
}

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RecommendationsStep — guided mode (FR-024/025/026)", () => {
  it("shows required, recommended, and alternatives sections", () => {
    const project = seedProject();
    render(<RecommendationsStep project={project} />);
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByText("Alternatives")).toBeInTheDocument();
    expect(screen.getByTestId("recommendation-item-framework-react")).toBeInTheDocument();
  });

  it("accepting a recommendation persists it as a deterministic selection (FR-026/027)", async () => {
    const project = seedProject();
    const user = userEvent.setup();
    render(<RecommendationsStep project={project} />);

    const reactRow = screen.getByTestId("recommendation-item-framework-react");
    await user.click(within(reactRow).getByRole("button"));

    await waitFor(() => {
      const updated = currentProject(project.id);
      expect(
        updated.selections.some((s) => s.itemId === "framework-react" && s.decision === "accepted"),
      ).toBe(true);
    });
    const selection = currentProject(project.id).selections.find(
      (s) => s.itemId === "framework-react",
    );
    expect(selection?.source).toBe("deterministic");
  });
});

describe("RecommendationsStep — manual mode (AC-016 spirit: no silent auto-select)", () => {
  it("hides Recommended/Alternatives sections in manual mode", () => {
    const project = seedProject();
    project.configuration.selectionMode = "manual";
    render(<RecommendationsStep project={project} />);
    expect(screen.queryByText("Recommended")).not.toBeInTheDocument();
    expect(screen.queryByText("Alternatives")).not.toBeInTheDocument();
  });

  it("still allows manual search and add", async () => {
    const project = seedProject();
    project.configuration.selectionMode = "manual";
    const user = userEvent.setup();
    render(<RecommendationsStep project={project} />);

    await user.type(screen.getByLabelText("Search by name"), "React");
    const row = await screen.findByTestId("manual-search-item-framework-react");
    await user.click(within(row).getByRole("button"));

    await waitFor(() => {
      expect(
        currentProject(project.id).selections.some((s) => s.itemId === "framework-react"),
      ).toBe(true);
    });
  });
});

describe("RecommendationsStep — removed stays removed (AC-016)", () => {
  it("does not silently restore a removed selection when the step re-renders", async () => {
    const project = seedProject();
    const user = userEvent.setup();
    const { rerender } = render(<RecommendationsStep project={project} />);

    let reactRow = screen.getByTestId("recommendation-item-framework-react");
    await user.click(within(reactRow).getByRole("button")); // Accept
    await waitFor(() => {
      expect(
        currentProject(project.id).selections.some((s) => s.itemId === "framework-react"),
      ).toBe(true);
    });

    rerender(<RecommendationsStep project={currentProject(project.id)} />);
    reactRow = screen.getByTestId("recommendation-item-framework-react");
    await user.click(within(reactRow).getByRole("button")); // Remove
    await waitFor(() => {
      const selection = currentProject(project.id).selections.find(
        (s) => s.itemId === "framework-react",
      );
      expect(selection?.decision).toBe("removed");
    });

    rerender(<RecommendationsStep project={currentProject(project.id)} />);
    const selectionAfterRerender = currentProject(project.id).selections.find(
      (s) => s.itemId === "framework-react",
    );
    expect(selectionAfterRerender?.decision).toBe("removed");
  });
});

describe("RecommendationsStep — validation panel (FR-028/029, AC-018)", () => {
  it("shows a blocker for a hard conflict and never offers to acknowledge it", () => {
    const project = seedProject();
    let selections = acceptCatalogSelection(project.selections, project.id, jestItem, "manual");
    selections = acceptCatalogSelection(selections, project.id, vitestItem, "manual");
    project.selections = selections;
    useProjectsStore.setState({ projects: [project] });

    render(<RecommendationsStep project={project} />);

    expect(screen.getByText("Blocker")).toBeInTheDocument();
    expect(
      screen.getByText(/One or more issues currently block package export/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Acknowledge")).not.toBeInTheDocument();
  });

  it("lets a warning be acknowledged with a reason", async () => {
    const project = seedProject();
    const deprecatedHook = SYSTEM_CATALOG_ITEMS.find(
      (item) => item.id === "hook-post-commit-notify",
    )!;
    project.selections = acceptCatalogSelection(
      project.selections,
      project.id,
      deprecatedHook,
      "manual",
    );
    useProjectsStore.setState({ projects: [project] });

    const user = userEvent.setup();
    const { rerender } = render(<RecommendationsStep project={project} />);

    expect(screen.getByText("Warning")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Reason for acknowledging"), "Keeping for now");
    await user.click(screen.getByText("Acknowledge"));

    await waitFor(() => {
      const validation = currentProject(project.id).validation;
      expect(validation.issues.some((i) => i.override?.reason === "Keeping for now")).toBe(true);
    });

    // Regression: `computeValidation` recomputes fresh on every render (no persisted
    // `ValidationRun`), so the step must carry the just-recorded override forward onto the
    // re-rendered issue list — otherwise the UI silently reverts to "not yet acknowledged" even
    // though the store already recorded it (see `computeValidation` in `recommendationsStore.ts`).
    rerender(<RecommendationsStep project={currentProject(project.id)} />);
    expect(screen.getByText("Acknowledged: Keeping for now")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Reason for acknowledging")).not.toBeInTheDocument();
  });
});
