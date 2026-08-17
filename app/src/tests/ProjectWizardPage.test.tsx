import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { ProjectWizardPage } from "../pages/wizard/ProjectWizardPage";
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
    settings: { ...DEFAULT_SETTINGS, autosaveEnabled: false, ai: { ...DEFAULT_SETTINGS.ai } },
    hydrated: true,
    undoSnapshot: null,
  });
}

function seedProject(name = "Wizard Project") {
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

function renderWizard(projectId: string, stepId: string) {
  return render(
    <MemoryRouter initialEntries={[`/projects/${projectId}/wizard/${stepId}`]}>
      <Routes>
        <Route path="/projects/:projectId/wizard/:stepId" element={<ProjectWizardPage />} />
        <Route path="/projects/:projectId" element={<div data-testid="navigated-to-overview" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetStores();
});

describe("ProjectWizardPage step rail (FR-010, Recommendations enabled per Phase 4/5)", () => {
  it("numbers 10 visible steps contiguously with Review last, including Recommendations", () => {
    const project = seedProject();
    renderWizard(project.id, "identity");

    const rail = screen.getByRole("navigation", { name: "Wizard steps" });
    const items = within(rail).getAllByRole("listitem");
    expect(items).toHaveLength(10);
    expect(within(rail).getByText("Recommendations and manual catalog")).toBeInTheDocument();

    const reviewButton = within(rail).getByRole("button", { name: /Review and configure/ });
    expect(within(reviewButton).getByText("10")).toBeInTheDocument();
  });
});

describe("DomainsStep (FR-011, AC-008, AC-009)", () => {
  it("blocks Continue until a domain is selected, then advances to the next step", async () => {
    const project = seedProject();
    const user = userEvent.setup();
    renderWizard(project.id, "domains");

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await user.click(screen.getByLabelText("Web"));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Platforms and scope" })).toBeInTheDocument();
  });

  it("cancelling a domain removal preserves the domain and every dependent value", async () => {
    const project = seedProject();
    useProjectsStore.setState((state) => ({
      projects: state.projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              configuration: {
                ...p.configuration,
                domainIds: ["domain-mobile"],
                enabledCapabilities: ["app-store-distribution", "push-notifications"],
              },
            }
          : p,
      ),
    }));
    const user = userEvent.setup();
    renderWizard(project.id, "domains");

    await user.click(screen.getByLabelText("Mobile"));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText("Mobile")).toBeChecked();
    const stored = useProjectsStore.getState().projects.find((p) => p.id === project.id);
    expect(stored?.configuration.domainIds).toEqual(["domain-mobile"]);
    expect(stored?.configuration.enabledCapabilities).toEqual([
      "app-store-distribution",
      "push-notifications",
    ]);
  });

  it("confirming a domain removal clears only the dependent capabilities shown in the impact dialog", async () => {
    const project = seedProject();
    useProjectsStore.setState((state) => ({
      projects: state.projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              configuration: {
                ...p.configuration,
                domainIds: ["domain-mobile"],
                targetPlatforms: ["ios"],
                enabledCapabilities: ["app-store-distribution", "push-notifications"],
              },
            }
          : p,
      ),
    }));
    const user = userEvent.setup();
    renderWizard(project.id, "domains");

    await user.click(screen.getByLabelText("Mobile"));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/app-store-distribution, push-notifications/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove domain" }));

    await waitFor(() => expect(screen.getByLabelText("Mobile")).not.toBeChecked());
    const stored = useProjectsStore.getState().projects.find((p) => p.id === project.id);
    expect(stored?.configuration.domainIds).toEqual([]);
    expect(stored?.configuration.enabledCapabilities).toEqual([]);
    // Generic/shared data is untouched by the domain-scoped removal.
    expect(stored?.configuration.targetPlatforms).toEqual(["ios"]);
  });
});

describe("RequirementsPanel inside FunctionalRequirementsStep (FR-014)", () => {
  it("adds, edits, reprioritizes, and removes a requirement", async () => {
    const project = seedProject();
    const user = userEvent.setup();
    renderWizard(project.id, "functionalRequirements");

    expect(screen.getByText("Add your first requirement below.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Title"), "Login");
    await user.type(screen.getByLabelText("Description"), "Users can log in");
    await user.click(screen.getByRole("button", { name: "Add requirement" }));

    expect(await screen.findByText("Login")).toBeInTheDocument();
    expect(
      useProjectsStore.getState().projects.find((p) => p.id === project.id)?.requirements,
    ).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const titleInput = screen.getByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Login flow");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    const listItem = (await screen.findByText("Login flow")).closest("li");
    expect(listItem).not.toBeNull();

    await user.selectOptions(within(listItem as HTMLElement).getByRole("combobox"), "must");
    expect(
      useProjectsStore.getState().projects.find((p) => p.id === project.id)?.requirements[0]
        .priority,
    ).toBe("must");

    await user.click(screen.getByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("Add your first requirement below.")).toBeInTheDocument();
  });
});

describe("SelectionExecutionStep (FR-016, AC-010)", () => {
  it("shows the automatic-mode note only once automatic is chosen, independently of execution profile", async () => {
    const project = seedProject();
    const user = userEvent.setup();
    renderWizard(project.id, "selectionExecution");

    expect(screen.queryByText(/pre-checks required\/recommended items/)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Automatic"));
    expect(screen.getByText(/pre-checks required\/recommended items/)).toBeInTheDocument();

    await user.click(screen.getByLabelText("Comprehensive"));
    expect(
      useProjectsStore.getState().projects.find((p) => p.id === project.id)?.configuration
        .executionProfile,
    ).toBe("comprehensive");
    expect(
      useProjectsStore.getState().projects.find((p) => p.id === project.id)?.configuration
        .selectionMode,
    ).toBe("automatic");
  });
});

describe("ReviewStep (FR-015)", () => {
  it("lists incomplete sections with working edit links and disables Mark configured", async () => {
    const project = seedProject();
    const user = userEvent.setup();
    renderWizard(project.id, "review");

    expect(screen.getByRole("button", { name: "Mark configured" })).toBeDisabled();
    const domainsLink = screen.getByRole("button", { name: "Domains" });
    await user.click(domainsLink);
    expect(await screen.findByRole("heading", { name: "Domains" })).toBeInTheDocument();
  });

  it("marks the project configured once every data step is complete and navigates to the overview", async () => {
    const project = seedProject();
    useProjectsStore.setState((state) => ({
      projects: state.projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              configuration: {
                ...p.configuration,
                domainIds: ["domain-web"],
                targetPlatforms: ["web"],
              },
              brief: { ...p.brief, targetUsers: ["Solo devs"], goals: ["Ship faster"] },
              requirements: [
                {
                  id: "requirement-1",
                  type: "functional",
                  title: "Login",
                  description: "Users can log in",
                  priority: "must",
                  status: "draft",
                  source: "user",
                  tags: [],
                  acceptanceCriteria: [],
                  verificationMethods: [],
                  createdAt: p.createdAt,
                  updatedAt: p.createdAt,
                },
                {
                  id: "requirement-2",
                  type: "non-functional",
                  title: "Fast",
                  description: "Loads quickly",
                  priority: "should",
                  status: "draft",
                  source: "user",
                  tags: [],
                  acceptanceCriteria: [],
                  verificationMethods: [],
                  createdAt: p.createdAt,
                  updatedAt: p.createdAt,
                },
              ],
            }
          : p,
      ),
    }));
    const user = userEvent.setup();
    renderWizard(project.id, "review");

    const markButton = screen.getByRole("button", { name: "Mark configured" });
    expect(markButton).toBeEnabled();
    await user.click(markButton);

    await waitFor(() => expect(screen.getByTestId("navigated-to-overview")).toBeInTheDocument());
    expect(useProjectsStore.getState().projects.find((p) => p.id === project.id)?.status).toBe(
      "configured",
    );
  });
});

describe("Save and exit", () => {
  it("flushes a pending edit and navigates back to the overview page", async () => {
    const project = seedProject();
    const user = userEvent.setup();
    renderWizard(project.id, "platformsScope");

    await user.type(screen.getByLabelText("Target platforms"), "web{enter}");
    await user.click(screen.getByRole("button", { name: "Save and exit" }));

    await waitFor(() => expect(screen.getByTestId("navigated-to-overview")).toBeInTheDocument());
    expect(
      useProjectsStore.getState().projects.find((p) => p.id === project.id)?.configuration
        .targetPlatforms,
    ).toEqual(["web"]);
  });
});
