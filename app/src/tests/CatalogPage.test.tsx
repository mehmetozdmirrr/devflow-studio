import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogPage } from "../pages/CatalogPage";
import { useCatalogStore } from "../application/catalogStore";
import { useProjectsStore } from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { defaultCatalogFilterState } from "../domain/catalog";
import { SYSTEM_CATALOG_ITEMS } from "../catalog/systemCatalog";

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
    <MemoryRouter>
      <CatalogPage />
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

describe("CatalogPage — search/filter (FR-017, AC-011)", () => {
  it("shows system catalog items across kinds", async () => {
    // 12-item-per-page pagination means the unfiltered list no longer renders every item at
    // once, so each cross-kind item is confirmed via a scoped search rather than assumed visible.
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Search catalog"), "React");
    expect(screen.getByText("React")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Search catalog"));
    await user.type(screen.getByLabelText("Search catalog"), "PostgreSQL");
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
  });

  it("filters results by free-text search", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Search catalog"), "postgres");
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.queryByText("React")).not.toBeInTheDocument();
  });

  it("shows a no-results state with a clear-filters action when a filter matches nothing", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Search catalog"), "zzz-no-such-item-zzz");
    expect(screen.getByText("No matching catalog items")).toBeInTheDocument();
    const clearButtons = screen.getAllByText("Clear filters");
    await user.click(clearButtons[0]);
    // Pagination shows only the first 12 items — confirm the full result set is back via the
    // result-count text rather than assuming any specific item lands on page 1.
    expect(
      screen.getByText(new RegExp(`Showing 1.*of ${SYSTEM_CATALOG_ITEMS.length}`)),
    ).toBeInTheDocument();
  });
});

describe("CatalogPage — system item read-only + clone (FR-018/020, AC-012)", () => {
  it("offers Clone as custom for a system item instead of Edit/Delete", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Search catalog"), "React");
    await user.click(screen.getByText("React"));
    expect(screen.getByText("Clone as custom")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("clones a system item into an editable user item", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Search catalog"), "React");
    await user.click(screen.getByText("React"));
    await user.click(screen.getByText("Clone as custom"));
    await waitFor(() => {
      expect(useCatalogStore.getState().userItems).toHaveLength(1);
    });
    expect(useCatalogStore.getState().userItems[0].origin).toBe("user");
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });
});

describe("CatalogPage — user catalog CRUD (FR-019, AC-013)", () => {
  it("creates a valid custom user item", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Create custom item"));
    await user.type(screen.getByLabelText("Name"), "My Custom Lib");
    await user.type(screen.getByLabelText("Short description (English)"), "short");
    await user.type(screen.getByLabelText("Short description (Turkish)"), "kısa");
    await user.type(screen.getByLabelText("Description (English)"), "description");
    await user.type(screen.getByLabelText("Description (Turkish)"), "açıklama");
    await user.click(screen.getByText("Create item"));
    await waitFor(() => {
      expect(useCatalogStore.getState().userItems).toHaveLength(1);
    });
    expect(useCatalogStore.getState().userItems[0].name).toBe("My Custom Lib");
  });

  it("rejects an invalid import file and leaves the catalog unchanged", async () => {
    renderPage();
    const file = new File([JSON.stringify({ nonsense: true })], "bad.json", {
      type: "application/json",
    });
    const input = screen.getByLabelText("Choose a user catalog JSON file") as HTMLInputElement;
    await userEvent.upload(input, file);
    expect(
      await screen.findByText(/isn't a valid DevFlow user catalog export/),
    ).toBeInTheDocument();
    expect(useCatalogStore.getState().userItems).toEqual([]);
  });
});

describe("CatalogPage — comparison selection (FR-022, AC-014)", () => {
  it("shows a limit message and does not add a 5th compare item", async () => {
    const user = userEvent.setup();
    renderPage();
    const addButtons = screen.getAllByText("Add to compare");
    for (let i = 0; i < 4; i += 1) {
      await user.click(addButtons[i]);
    }
    expect(useCatalogStore.getState().compareItemIds).toHaveLength(4);
    await user.click(addButtons[4]);
    expect(screen.getByText(/You can compare up to 4 items/)).toBeInTheDocument();
    expect(useCatalogStore.getState().compareItemIds).toHaveLength(4);
  });
});
