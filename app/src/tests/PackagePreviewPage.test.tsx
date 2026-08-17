import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { PackagePreviewPage } from "../pages/PackagePreviewPage";
import { useProjectsStore } from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import { useCatalogStore } from "../application/catalogStore";
import { usePackageStore } from "../application/packageStore";
import { defaultCatalogFilterState } from "../domain/catalog";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { createDraftProject } from "../domain/project";
import { SYSTEM_CATALOG_ITEMS } from "../catalog/systemCatalog";

function resetStores(): void {
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
    settings: { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai } },
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
  usePackageStore.setState({ resultsByProjectId: {} });
}

function seedProject(name = "Package Test Project") {
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
    <MemoryRouter initialEntries={[`/projects/${projectId}/package`]}>
      <Routes>
        <Route path="/projects/:projectId/package" element={<PackagePreviewPage />} />
        <Route path="/projects/:projectId" element={<div data-testid="navigated-to-overview" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetStores();
});

describe("PackagePreviewPage", () => {
  it("shows a not-found state for an unknown project id", () => {
    renderPage("does-not-exist");
    expect(screen.getByText("This project doesn't exist or was removed.")).toBeInTheDocument();
  });

  it("shows an empty state until the user generates a preview, then renders files with no blockers", async () => {
    const project = seedProject();
    renderPage(project.id);

    expect(
      screen.getByText('Select "Generate preview" to build the package for this project.'),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generate preview" }));

    await waitFor(() => expect(screen.getByText("CLAUDE.md")).toBeInTheDocument());
    expect(screen.getByText(/Package ready/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download ZIP" })).toBeEnabled();
  });

  it("disables ZIP download when a blocker issue is present", async () => {
    const project = seedProject();
    useProjectsStore.setState((state) => ({
      projects: state.projects.map((candidate) =>
        candidate.id === project.id
          ? {
              ...candidate,
              packageSettings: {
                ...candidate.packageSettings,
                textOverrides: { "docs/ROADMAP.md": "AWS_SECRET_ACCESS_KEY=abcdefghij1234567890" },
              },
            }
          : candidate,
      ),
    }));
    renderPage(project.id);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generate preview" }));

    await waitFor(() => expect(screen.getByText("Blocker")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Download ZIP" })).toBeDisabled();
  });
});
