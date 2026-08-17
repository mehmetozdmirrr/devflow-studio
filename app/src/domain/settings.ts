import type { UserSettings } from "@contracts/settings";

export const SETTINGS_SCHEMA_VERSION = 1;

export const AI_CONSENT_NOTICE_VERSION = "phase-1-preview";

export const DEFAULT_SETTINGS: UserSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  uiLanguage: "en",
  defaultOutputLanguage: "en",
  theme: "system",
  defaultExperienceProfile: "beginner",
  defaultSelectionMode: "guided",
  defaultExecutionProfile: "balanced",
  autosaveEnabled: true,
  projectView: "cards",
  favoriteCatalogItemIds: [],
  ai: {
    enabled: false,
  },
};

export function cloneDefaultSettings(): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    favoriteCatalogItemIds: [...DEFAULT_SETTINGS.favoriteCatalogItemIds],
    ai: { ...DEFAULT_SETTINGS.ai },
  };
}
