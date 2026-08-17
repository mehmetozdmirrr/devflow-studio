import { create } from "zustand";
import type {
  ExecutionProfile,
  ExperienceProfile,
  Identifier,
  Locale,
  SelectionMode,
  ThemeMode,
} from "@contracts/common";
import type { UserSettings } from "@contracts/settings";

import { AI_CONSENT_NOTICE_VERSION, cloneDefaultSettings } from "../domain/settings";
import {
  LocalStorageSettingsAdapter,
  clearNamespacedLocalData,
  exportNamespacedLocalData,
} from "../adapters/localStorageSettingsAdapter";
import i18n from "../i18n";

const repository = new LocalStorageSettingsAdapter();

interface SettingsState {
  settings: UserSettings;
  hydrated: boolean;
  undoSnapshot: UserSettings | null;
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setUiLanguage: (locale: Locale) => Promise<void>;
  setDefaultOutputLanguage: (locale: Locale) => Promise<void>;
  setDefaultExperienceProfile: (profile: ExperienceProfile) => Promise<void>;
  setDefaultSelectionMode: (mode: SelectionMode) => Promise<void>;
  setDefaultExecutionProfile: (profile: ExecutionProfile) => Promise<void>;
  setAutosaveEnabled: (enabled: boolean) => Promise<void>;
  setAiEnabled: (enabled: boolean) => Promise<void>;
  toggleFavoriteCatalogItem: (itemId: Identifier) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  undoReset: () => Promise<void>;
  exportLocalData: () => Record<string, unknown>;
  clearAllLocalData: () => Promise<void>;
}

async function persist(settings: UserSettings): Promise<void> {
  await repository.save(settings);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: cloneDefaultSettings(),
  hydrated: false,
  undoSnapshot: null,

  hydrate: async () => {
    const settings = await repository.get();
    set({ settings, hydrated: true });
    void i18n.changeLanguage(settings.uiLanguage);
  },

  setTheme: async (theme) => {
    const settings = { ...get().settings, theme };
    set({ settings });
    await persist(settings);
  },

  setUiLanguage: async (uiLanguage) => {
    const settings = { ...get().settings, uiLanguage };
    set({ settings });
    await persist(settings);
    void i18n.changeLanguage(uiLanguage);
  },

  setDefaultOutputLanguage: async (defaultOutputLanguage) => {
    const settings = { ...get().settings, defaultOutputLanguage };
    set({ settings });
    await persist(settings);
  },

  setDefaultExperienceProfile: async (defaultExperienceProfile) => {
    const settings = { ...get().settings, defaultExperienceProfile };
    set({ settings });
    await persist(settings);
  },

  setDefaultSelectionMode: async (defaultSelectionMode) => {
    const settings = { ...get().settings, defaultSelectionMode };
    set({ settings });
    await persist(settings);
  },

  setDefaultExecutionProfile: async (defaultExecutionProfile) => {
    const settings = { ...get().settings, defaultExecutionProfile };
    set({ settings });
    await persist(settings);
  },

  setAutosaveEnabled: async (autosaveEnabled) => {
    const settings = { ...get().settings, autosaveEnabled };
    set({ settings });
    await persist(settings);
  },

  setAiEnabled: async (enabled) => {
    const previous = get().settings;
    const settings: UserSettings = {
      ...previous,
      ai: enabled
        ? {
            enabled: true,
            consentAcceptedAt: new Date().toISOString(),
            consentNoticeVersion: AI_CONSENT_NOTICE_VERSION,
          }
        : { ...previous.ai, enabled: false },
    };
    set({ settings });
    await persist(settings);
  },

  toggleFavoriteCatalogItem: async (itemId) => {
    const previous = get().settings;
    const isFavorite = previous.favoriteCatalogItemIds.includes(itemId);
    const favoriteCatalogItemIds = isFavorite
      ? previous.favoriteCatalogItemIds.filter((id) => id !== itemId)
      : [...previous.favoriteCatalogItemIds, itemId];
    const settings = { ...previous, favoriteCatalogItemIds };
    set({ settings });
    await persist(settings);
  },

  resetToDefaults: async () => {
    const undoSnapshot = get().settings;
    const defaults = cloneDefaultSettings();
    set({ settings: defaults, undoSnapshot });
    await persist(defaults);
    void i18n.changeLanguage(defaults.uiLanguage);
  },

  undoReset: async () => {
    const snapshot = get().undoSnapshot;
    if (!snapshot) return;
    set({ settings: snapshot, undoSnapshot: null });
    await persist(snapshot);
    void i18n.changeLanguage(snapshot.uiLanguage);
  },

  exportLocalData: () => exportNamespacedLocalData(),

  clearAllLocalData: async () => {
    clearNamespacedLocalData();
    const defaults = cloneDefaultSettings();
    set({ settings: defaults, undoSnapshot: null });
    void i18n.changeLanguage(defaults.uiLanguage);
  },
}));
