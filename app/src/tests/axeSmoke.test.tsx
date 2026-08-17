import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { LandingPage } from "../pages/LandingPage";
import { CatalogPage } from "../pages/CatalogPage";
import { ComparePage } from "../pages/ComparePage";
import { SettingsPage } from "../pages/SettingsPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { ProjectCreatePage } from "../pages/ProjectCreatePage";
import { TrashPage } from "../pages/TrashPage";
import { ProjectWizardPage } from "../pages/wizard/ProjectWizardPage";
import { PackagePreviewPage } from "../pages/PackagePreviewPage";
import { AIAnalysisPage } from "../pages/AIAnalysisPage";
import { useProjectsStore } from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import { useCatalogStore } from "../application/catalogStore";
import { usePackageStore, computePackageBuildResult } from "../application/packageStore";
import { useAIStore } from "../application/aiStore";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { defaultCatalogFilterState } from "../domain/catalog";
import { createDraftProject } from "../domain/project";
import { SYSTEM_CATALOG_ITEMS } from "../catalog/systemCatalog";

beforeEach(() => {
  useProjectsStore.setState({
    projects: [],
    hydrated: false,
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
});

function seedHydratedProject() {
  const project = createDraftProject(
    {
      name: "Axe Project",
      idea: "idea",
      problem: "problem",
      proposedSolution: "solution",
      experienceProfile: "beginner",
    },
    useSettingsStore.getState().settings,
  );
  useProjectsStore.setState({ projects: [project], hydrated: true, loadError: null });
  return project;
}

describe("accessibility smoke (NFR-001)", () => {
  it("Landing page has no automatically detectable a11y violations", async () => {
    const { container } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Catalog page (loading state) has no automatically detectable a11y violations", async () => {
    const { container } = render(
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  // The full 66-item catalog + axe's own scan is the heaviest case in this file; under
  // `vitest run --coverage`'s v8 instrumentation overhead across parallel workers it can exceed
  // the 5000ms default (never observed running standalone) — a real timeout budget for an
  // inherently slower scan, not a weakened assertion.
  it("Catalog page (hydrated, with a selected item detail panel) has no automatically detectable a11y violations", async () => {
    useCatalogStore.setState({
      systemItems: SYSTEM_CATALOG_ITEMS,
      userItems: [],
      hydrated: true,
      loadError: null,
      filters: defaultCatalogFilterState(),
      selectedItemId: "framework-react",
      compareItemIds: [],
      compareError: null,
    });
    const { container } = render(
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  }, 15000);

  it("Compare page (2 items selected) has no automatically detectable a11y violations", async () => {
    useCatalogStore.setState({
      systemItems: SYSTEM_CATALOG_ITEMS,
      userItems: [],
      hydrated: true,
      loadError: null,
      filters: defaultCatalogFilterState(),
      selectedItemId: null,
      compareItemIds: ["framework-react", "framework-express"],
      compareError: null,
    });
    const { container } = render(
      <MemoryRouter>
        <ComparePage />
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Settings page has no automatically detectable a11y violations", async () => {
    const { container } = render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Projects page (loading state) has no automatically detectable a11y violations", async () => {
    const { container } = render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Project create page has no automatically detectable a11y violations", async () => {
    const { container } = render(
      <MemoryRouter>
        <ProjectCreatePage />
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Trash page (loading state) has no automatically detectable a11y violations", async () => {
    const { container } = render(
      <MemoryRouter>
        <TrashPage />
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Wizard domains step has no automatically detectable a11y violations", async () => {
    const project = seedHydratedProject();
    const { container } = render(
      <MemoryRouter initialEntries={[`/projects/${project.id}/wizard/domains`]}>
        <Routes>
          <Route path="/projects/:projectId/wizard/:stepId" element={<ProjectWizardPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Wizard recommendations step has no automatically detectable a11y violations", async () => {
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
    const project = seedHydratedProject();
    const { container } = render(
      <MemoryRouter initialEntries={[`/projects/${project.id}/wizard/recommendations`]}>
        <Routes>
          <Route path="/projects/:projectId/wizard/:stepId" element={<ProjectWizardPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Wizard review step has no automatically detectable a11y violations", async () => {
    const project = seedHydratedProject();
    const { container } = render(
      <MemoryRouter initialEntries={[`/projects/${project.id}/wizard/review`]}>
        <Routes>
          <Route path="/projects/:projectId/wizard/:stepId" element={<ProjectWizardPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Package preview page (generated, with files and no issues) has no automatically detectable a11y violations", async () => {
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
    const project = seedHydratedProject();
    const result = await computePackageBuildResult(project, SYSTEM_CATALOG_ITEMS);
    usePackageStore.setState({ resultsByProjectId: { [project.id]: result } });
    const { container } = render(
      <MemoryRouter initialEntries={[`/projects/${project.id}/package`]}>
        <Routes>
          <Route path="/projects/:projectId/package" element={<PackagePreviewPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("AI analysis page (AI disabled) has no automatically detectable a11y violations", async () => {
    const project = seedHydratedProject();
    const { container } = render(
      <MemoryRouter initialEntries={[`/projects/${project.id}/ai`]}>
        <Routes>
          <Route path="/projects/:projectId/ai" element={<AIAnalysisPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("AI analysis page (consent notice, AI enabled) has no automatically detectable a11y violations", async () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, ai: { ...state.settings.ai, enabled: true } },
    }));
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
    const project = seedHydratedProject();
    useAIStore.setState({
      status: "idle",
      pendingRequest: undefined,
      lastError: undefined,
      reviewed: {},
    });
    const { container } = render(
      <MemoryRouter initialEntries={[`/projects/${project.id}/ai`]}>
        <Routes>
          <Route path="/projects/:projectId/ai" element={<AIAnalysisPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
