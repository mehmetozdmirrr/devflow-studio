import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComparePage } from "../pages/ComparePage";
import { useCatalogStore } from "../application/catalogStore";
import { useProjectsStore } from "../application/projectsStore";
import { defaultCatalogFilterState } from "../domain/catalog";
import { SYSTEM_CATALOG_ITEMS } from "../catalog/systemCatalog";

function resetStores(compareItemIds: string[] = []): void {
  useCatalogStore.setState({
    systemItems: SYSTEM_CATALOG_ITEMS,
    userItems: [],
    hydrated: true,
    loadError: null,
    filters: defaultCatalogFilterState(),
    selectedItemId: null,
    compareItemIds,
    compareError: null,
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

function renderPage() {
  return render(
    <MemoryRouter>
      <ComparePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ComparePage (FR-022, AC-014)", () => {
  it("shows an empty state when fewer than 2 items are selected for comparison", () => {
    resetStores(["framework-react"]);
    renderPage();
    expect(screen.getByText("Nothing to compare yet")).toBeInTheDocument();
  });

  it("renders a comparison matrix with shared criteria and Not available for missing fields", () => {
    resetStores(["framework-react", "framework-express"]);
    renderPage();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Express")).toBeInTheDocument();
    expect(screen.getAllByText("Not available").length).toBeGreaterThan(0);
  });

  it("removes an item from the comparison", async () => {
    const user = userEvent.setup();
    resetStores(["framework-react", "framework-express", "framework-nextjs"]);
    renderPage();
    const removeButtons = screen.getAllByText("Remove");
    await user.click(removeButtons[0]);
    expect(useCatalogStore.getState().compareItemIds).toHaveLength(2);
    expect(useCatalogStore.getState().compareItemIds).not.toContain("framework-react");
  });
});
