import { create } from "zustand";
import type { CatalogItem } from "@contracts/catalog";
import type { Identifier } from "@contracts/common";

import {
  addToComparisonSelection,
  cloneSystemItemToUserItem,
  createUserCatalogItem,
  defaultCatalogFilterState,
  hasCatalogFieldErrors,
  isCatalogImportPayloadShape,
  removeFromComparisonSelection,
  searchAndFilterCatalog,
  updateUserCatalogItem,
  validateUserCatalogItemInput,
  type CatalogFilterState,
  type CatalogItemFieldErrors,
  type CompareErrorReason,
  type UserCatalogItemInput,
} from "../domain/catalog";
import { acceptCatalogSelection } from "../domain/selections";
import { LocalStorageCatalogAdapter } from "../adapters/localStorageCatalogAdapter";
import { downloadJson } from "../adapters/downloadJson";
import { useProjectsStore } from "./projectsStore";

const repository = new LocalStorageCatalogAdapter();
const USER_CATALOG_VERSION = "user-v1";

export type CreateUserItemResult =
  { ok: true; item: CatalogItem } | { ok: false; errors: CatalogItemFieldErrors };

export type ImportUserCatalogResult =
  { ok: true; addedCount: number; skippedCount: number } | { ok: false; error: "invalid-shape" };

interface CatalogState {
  systemItems: CatalogItem[];
  userItems: CatalogItem[];
  hydrated: boolean;
  loadError: string | null;
  filters: CatalogFilterState;
  selectedItemId: Identifier | null;
  compareItemIds: Identifier[];
  compareError: CompareErrorReason | null;

  hydrate: () => Promise<void>;
  setFilters: (patch: Partial<CatalogFilterState>) => void;
  resetFilters: () => void;
  selectItem: (id: Identifier | null) => void;

  createUserItem: (input: UserCatalogItemInput) => Promise<CreateUserItemResult>;
  updateUserItem: (id: Identifier, input: UserCatalogItemInput) => Promise<CreateUserItemResult>;
  deleteUserItem: (id: Identifier) => Promise<void>;
  cloneSystemItem: (id: Identifier) => Promise<CatalogItem | null>;

  toggleCompare: (id: Identifier) => void;
  removeFromCompare: (id: Identifier) => void;
  replaceInComparison: (oldId: Identifier, newId: Identifier) => void;
  clearCompare: () => void;
  dismissCompareError: () => void;

  exportUserCatalog: () => void;
  previewImportUserCatalog: (
    candidate: unknown,
  ) => { ok: true } | { ok: false; error: "invalid-shape" };
  commitImportUserCatalog: (candidate: unknown) => Promise<ImportUserCatalogResult>;

  addItemToProject: (itemId: Identifier, projectId: Identifier) => Promise<boolean>;
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  systemItems: [],
  userItems: [],
  hydrated: false,
  loadError: null,
  filters: defaultCatalogFilterState(),
  selectedItemId: null,
  compareItemIds: [],
  compareError: null,

  hydrate: async () => {
    try {
      const [systemItems, userItems] = await Promise.all([
        repository.listSystem(),
        repository.listUser(),
      ]);
      set({ systemItems, userItems, hydrated: true, loadError: null });
    } catch (error) {
      set({ hydrated: true, loadError: error instanceof Error ? error.message : "unknown" });
    }
  },

  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  resetFilters: () => set({ filters: defaultCatalogFilterState() }),
  selectItem: (selectedItemId) => set({ selectedItemId }),

  createUserItem: async (input) => {
    const errors = validateUserCatalogItemInput(input);
    if (hasCatalogFieldErrors(errors)) return { ok: false, errors };
    const item = createUserCatalogItem(input);
    await repository.saveUser(item);
    set((state) => ({ userItems: [...state.userItems, item] }));
    return { ok: true, item };
  },

  updateUserItem: async (id, input) => {
    const errors = validateUserCatalogItemInput(input);
    if (hasCatalogFieldErrors(errors)) return { ok: false, errors };
    const existing = get().userItems.find((item) => item.id === id);
    if (!existing) return { ok: false, errors: {} };
    const updated = updateUserCatalogItem(existing, input);
    await repository.saveUser(updated);
    set((state) => ({
      userItems: state.userItems.map((item) => (item.id === id ? updated : item)),
    }));
    return { ok: true, item: updated };
  },

  deleteUserItem: async (id) => {
    await repository.deleteUser(id);
    set((state) => ({
      userItems: state.userItems.filter((item) => item.id !== id),
      compareItemIds: state.compareItemIds.filter((itemId) => itemId !== id),
      selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
    }));
  },

  cloneSystemItem: async (id) => {
    const source = get().systemItems.find((item) => item.id === id);
    if (!source) return null;
    const clone = cloneSystemItemToUserItem(source);
    await repository.saveUser(clone);
    set((state) => ({ userItems: [...state.userItems, clone] }));
    return clone;
  },

  toggleCompare: (id) => {
    const current = get().compareItemIds;
    if (current.includes(id)) {
      set({ compareItemIds: removeFromComparisonSelection(current, id) });
      return;
    }
    const result = addToComparisonSelection(current, id);
    if (result.ok) {
      set({ compareItemIds: result.itemIds, compareError: null });
    } else {
      set({ compareError: result.reason });
    }
  },

  removeFromCompare: (id) =>
    set((state) => ({ compareItemIds: removeFromComparisonSelection(state.compareItemIds, id) })),
  replaceInComparison: (oldId, newId) =>
    set((state) => ({
      compareItemIds: state.compareItemIds.map((id) => (id === oldId ? newId : id)),
    })),
  clearCompare: () => set({ compareItemIds: [], compareError: null }),
  dismissCompareError: () => set({ compareError: null }),

  exportUserCatalog: () => {
    const { userItems } = get();
    downloadJson(`devflow-user-catalog-${Date.now()}.json`, {
      schemaVersion: 1,
      catalogVersion: USER_CATALOG_VERSION,
      items: userItems,
    });
  },

  previewImportUserCatalog: (candidate) => {
    if (!isCatalogImportPayloadShape(candidate)) return { ok: false, error: "invalid-shape" };
    return { ok: true };
  },

  /** All-or-nothing shape validation (AC-013 "invalid import leaves catalog unchanged"); items whose id already exists in the combined catalog are skipped rather than overwritten. */
  commitImportUserCatalog: async (candidate) => {
    if (!isCatalogImportPayloadShape(candidate)) return { ok: false, error: "invalid-shape" };
    const { systemItems, userItems } = get();
    const existingIds = new Set([...systemItems, ...userItems].map((item) => item.id));
    const toAdd = candidate.items.filter((item) => !existingIds.has(item.id));
    const skippedCount = candidate.items.length - toAdd.length;
    for (const item of toAdd) {
      await repository.saveUser(item);
    }
    set((state) => ({ userItems: [...state.userItems, ...toAdd] }));
    return { ok: true, addedCount: toAdd.length, skippedCount };
  },

  /** FR-023: explicit action linking a favorited/browsed catalog item into an existing project's selections. */
  addItemToProject: async (itemId, projectId) => {
    const item = [...get().systemItems, ...get().userItems].find(
      (candidate) => candidate.id === itemId,
    );
    const project = useProjectsStore
      .getState()
      .projects.find((candidate) => candidate.id === projectId);
    if (!item || !project) return false;
    const selections = acceptCatalogSelection(project.selections, projectId, item, "manual");
    useProjectsStore.getState().updateProjectDraft(projectId, { selections });
    await useProjectsStore.getState().saveProjectNow(projectId);
    return true;
  },
}));

export function selectAllCatalogItems(state: CatalogState): CatalogItem[] {
  return [...state.systemItems, ...state.userItems];
}

export function selectVisibleCatalogItems(state: CatalogState): CatalogItem[] {
  return searchAndFilterCatalog(selectAllCatalogItems(state), state.filters);
}

export function selectCompareItems(state: CatalogState): CatalogItem[] {
  const all = selectAllCatalogItems(state);
  return state.compareItemIds
    .map((id) => all.find((item) => item.id === id))
    .filter((item): item is CatalogItem => item !== undefined);
}
