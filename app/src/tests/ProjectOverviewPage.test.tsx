import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { ProjectOverviewPage } from "../pages/ProjectOverviewPage";
import { useProjectsStore } from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { createDraftProject } from "../domain/project";

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
}

function seedProject(name = "Seed Project") {
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
    <MemoryRouter initialEntries={[`/projects/${projectId}`]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectOverviewPage />} />
        <Route path="/projects" element={<div data-testid="navigated-to-list" />} />
        <Route
          path="/projects/:projectId/wizard/:stepId"
          element={<div data-testid="navigated-to-wizard" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetStores();
});

describe("ProjectOverviewPage", () => {
  it("shows a not-found state for an unknown project id", () => {
    renderPage("does-not-exist");
    expect(screen.getByText("Project not found")).toBeInTheDocument();
  });

  it("edits persist automatically when autosave is enabled (AC-003)", async () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, autosaveEnabled: true },
    }));
    const project = seedProject();
    const user = userEvent.setup();
    renderPage(project.id);

    const nameInput = screen.getByLabelText("Project name");
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed");

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    await waitFor(
      () => expect(useProjectsStore.getState().dirtyProjectIds.has(project.id)).toBe(false),
      { timeout: 3000 },
    );
    expect(useProjectsStore.getState().projects[0].meta.name).toBe("Renamed");
  }, 10000);

  it("shows a dirty indicator and an explicit Save action when autosave is disabled", async () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, autosaveEnabled: false },
    }));
    const project = seedProject();
    const user = userEvent.setup();
    renderPage(project.id);

    const nameInput = screen.getByLabelText("Project name");
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed");

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(useProjectsStore.getState().projects[0].meta.name).toBe("Renamed"));
    expect(useProjectsStore.getState().dirtyProjectIds.has(project.id)).toBe(false);
  });

  it("clones the project", async () => {
    const project = seedProject();
    const user = userEvent.setup();
    renderPage(project.id);

    await user.click(screen.getByRole("button", { name: "Clone" }));

    await waitFor(() => expect(useProjectsStore.getState().projects).toHaveLength(2));
    expect(useProjectsStore.getState().projects.some((p) => p.id === project.id)).toBe(true);
  });

  it("moves the project to trash after confirmation and navigates to the projects list", async () => {
    const project = seedProject();
    const user = userEvent.setup();
    renderPage(project.id);

    await user.click(screen.getByRole("button", { name: "Move to trash" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Move to trash" }));

    await waitFor(() => expect(screen.getByTestId("navigated-to-list")).toBeInTheDocument());
    expect(useProjectsStore.getState().projects.find((p) => p.id === project.id)?.status).toBe(
      "trashed",
    );
  });

  it("Continue configuration navigates into the wizard at the resume step", async () => {
    const project = seedProject();
    const user = userEvent.setup();
    renderPage(project.id);

    await user.click(screen.getByRole("button", { name: "Continue configuration" }));

    await waitFor(() => expect(screen.getByTestId("navigated-to-wizard")).toBeInTheDocument());
  });

  it("adds a requirement through the always-reachable Requirements panel", async () => {
    const project = seedProject();
    const user = userEvent.setup();
    renderPage(project.id);

    await user.type(screen.getByLabelText("Title"), "Login");
    await user.type(screen.getByLabelText("Description"), "Users can log in");
    await user.click(screen.getByRole("button", { name: "Add requirement" }));

    expect(await screen.findByText("Login")).toBeInTheDocument();
    expect(
      useProjectsStore.getState().projects.find((p) => p.id === project.id)?.requirements,
    ).toHaveLength(1);
  });

  it("shows an accepted selection and lets the user remove a custom one (FR-026/027)", async () => {
    const project = seedProject();
    useProjectsStore.setState((state) => ({
      projects: state.projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              selections: [
                {
                  id: "selection-1",
                  projectId: p.id,
                  snapshot: {
                    itemId: "custom-1",
                    itemVersion: "1.0.0",
                    name: "My Custom Tool",
                    kind: "library",
                    verification: "unverified",
                  },
                  source: "custom",
                  decision: "accepted",
                  sourceRuleIds: [],
                  requiredBySelectionIds: [],
                  warningOverrideIds: [],
                  createdAt: p.createdAt,
                  updatedAt: p.createdAt,
                },
              ],
            }
          : p,
      ),
    }));
    const user = userEvent.setup();
    renderPage(project.id);

    expect(await screen.findByText("My Custom Tool")).toBeInTheDocument();
    expect(screen.getByText("No validation issues.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(
        useProjectsStore.getState().projects.find((p) => p.id === project.id)?.selections,
      ).toHaveLength(0);
    });
  });
});
