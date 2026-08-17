import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { TrashPage } from "../pages/TrashPage";
import { useProjectsStore } from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { createDraftProject, trashProject } from "../domain/project";

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

function seedTrashedProject(name: string) {
  const draft = createDraftProject(
    {
      name,
      idea: "idea",
      problem: "problem",
      proposedSolution: "solution",
      experienceProfile: "beginner",
    },
    useSettingsStore.getState().settings,
  );
  const trashed = trashProject(draft);
  useProjectsStore.setState((state) => ({ projects: [...state.projects, trashed] }));
  return trashed;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TrashPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetStores();
});

describe("TrashPage (FR-005/AC-004)", () => {
  it("shows the empty state when trash is empty", () => {
    renderPage();
    expect(screen.getByText("Trash is empty")).toBeInTheDocument();
  });

  it("restores a trashed project", async () => {
    const trashed = seedTrashedProject("Alpha");
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Restore"));

    await waitFor(() =>
      expect(
        useProjectsStore.getState().projects.find((project) => project.id === trashed.id)?.status,
      ).toBe("draft"),
    );
    expect(await screen.findByText('"Alpha" restored.')).toBeInTheDocument();
  });

  it("requires the exact project name before permanent delete is allowed", async () => {
    seedTrashedProject("Alpha");
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Delete permanently"));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText('Type "Alpha" to confirm'), "not alpha");
    await user.click(within(dialog).getByRole("button", { name: "Delete permanently" }));
    expect(within(dialog).getByText("Doesn't match yet.")).toBeInTheDocument();
    expect(useProjectsStore.getState().projects).toHaveLength(1);

    await user.clear(within(dialog).getByLabelText('Type "Alpha" to confirm'));
    await user.type(within(dialog).getByLabelText('Type "Alpha" to confirm'), "Alpha");
    await user.click(within(dialog).getByRole("button", { name: "Delete permanently" }));

    await waitFor(() => expect(useProjectsStore.getState().projects).toHaveLength(0));
  });
});
