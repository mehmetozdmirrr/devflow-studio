import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectsPage } from "../pages/ProjectsPage";
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

function seedProject(name: string) {
  const project = createDraftProject(
    {
      name,
      idea: `idea for ${name}`,
      problem: "problem",
      proposedSolution: "solution",
      experienceProfile: "beginner",
    },
    useSettingsStore.getState().settings,
  );
  useProjectsStore.setState((state) => ({ projects: [...state.projects, project] }));
  return project;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetStores();
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProjectsPage — states (FR-002/AC-002)", () => {
  it("shows the empty state when there are no projects", () => {
    renderPage();
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
  });

  it("shows a no-results state when a search matches nothing, and Clear filters resets it", async () => {
    seedProject("Alpha");
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Search projects"), "zzz-no-match");
    expect(await screen.findByText("No matching projects")).toBeInTheDocument();

    await user.click(screen.getAllByText("Clear filters")[0]);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });
});

describe("ProjectsPage — lifecycle actions", () => {
  it("clones a project", async () => {
    const project = seedProject("Alpha");
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Clone"));

    await waitFor(() => expect(useProjectsStore.getState().projects).toHaveLength(2));
    expect(useProjectsStore.getState().projects.some((p) => p.id === project.id)).toBe(true);
  });

  it("archives a project after confirmation", async () => {
    seedProject("Alpha");
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Archive"));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(useProjectsStore.getState().projects[0].status).toBe("archived"));
  });

  it("trashes a project, shows undo, and undo restores it", async () => {
    seedProject("Alpha");
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Move to trash"));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Move to trash" }));

    await waitFor(() => expect(useProjectsStore.getState().projects[0].status).toBe("trashed"));
    const undoButton = await screen.findByText("Undo");
    await user.click(undoButton);

    await waitFor(() => expect(useProjectsStore.getState().projects[0].status).toBe("draft"));
  });
});

describe("ProjectsPage — export/import backup (FR-006)", () => {
  it("exports a backup by triggering a download", async () => {
    seedProject("Alpha");
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Export backup"));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it("previews an import, shows conflict/new counts, and commits the resolved merge", async () => {
    const existing = seedProject("Alpha");
    const user = userEvent.setup();
    renderPage();

    const backup = {
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      projects: [
        { ...existing, meta: { ...existing.meta, name: "Conflicting Rename" } },
        { ...existing, id: "project-new-one", meta: { ...existing.meta, name: "Brand New" } },
      ],
      userCatalogItems: [],
    };
    const file = new File([JSON.stringify(backup)], "backup.json", { type: "application/json" });

    await user.upload(screen.getByLabelText("Backup file"), file);

    expect(await screen.findByText("1 new project(s) will be added.")).toBeInTheDocument();
    expect(
      screen.getByText("1 project(s) already exist locally and need a choice."),
    ).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Import"));

    await waitFor(() => expect(useProjectsStore.getState().projects).toHaveLength(2));
  });

  it("rejects a malformed import file", async () => {
    renderPage();
    const file = new File(["not json"], "backup.json", { type: "application/json" });
    const user = userEvent.setup();

    await user.upload(screen.getByLabelText("Backup file"), file);

    expect(await screen.findByText("This file isn't valid JSON.")).toBeInTheDocument();
  });
});
