import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { ProjectCreatePage } from "../pages/ProjectCreatePage";
import { useProjectsStore } from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import { DEFAULT_SETTINGS } from "../domain/settings";

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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/new"]}>
      <Routes>
        <Route path="/projects/new" element={<ProjectCreatePage />} />
        <Route
          path="/projects/:projectId/wizard/:stepId"
          element={<div data-testid="navigated-to-overview" />}
        />
        <Route path="/projects" element={<div data-testid="navigated-to-list" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetStores();
});

describe("ProjectCreatePage (FR-001/AC-001)", () => {
  it("shows validation errors and does not create a project when required fields are empty", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect((await screen.findAllByText("This field is required.")).length).toBeGreaterThan(0);
    expect(useProjectsStore.getState().projects).toHaveLength(0);
  });

  it("creates a project and navigates to its overview page", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Project name"), "My Project");
    await user.type(screen.getByLabelText("Idea"), "An idea");
    await user.type(screen.getByLabelText("Problem"), "A problem");
    await user.type(screen.getByLabelText("Proposed solution"), "A solution");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(screen.getByTestId("navigated-to-overview")).toBeInTheDocument());
    expect(useProjectsStore.getState().projects).toHaveLength(1);
    expect(useProjectsStore.getState().projects[0].meta.name).toBe("My Project");
  });

  it("cancel navigates back to the projects list without creating anything", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.getByTestId("navigated-to-list")).toBeInTheDocument());
    expect(useProjectsStore.getState().projects).toHaveLength(0);
  });
});
