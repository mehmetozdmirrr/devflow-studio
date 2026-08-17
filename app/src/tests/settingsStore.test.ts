import { beforeEach, describe, expect, it } from "vitest";

import { useSettingsStore } from "../application/settingsStore";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { SETTINGS_STORAGE_KEY } from "../adapters/localStorageSettingsAdapter";

function readStoredSettings() {
  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai } },
    hydrated: false,
    undoSnapshot: null,
  });
});

describe("settingsStore defaults", () => {
  it("defaults defaultOutputLanguage to English", () => {
    expect(useSettingsStore.getState().settings.defaultOutputLanguage).toBe("en");
  });

  it("defaults AI to disabled with no consent recorded", () => {
    const { ai } = useSettingsStore.getState().settings;
    expect(ai.enabled).toBe(false);
    expect(ai.consentAcceptedAt).toBeUndefined();
  });
});

describe("output language independence (FR-045)", () => {
  it("changing uiLanguage does not change defaultOutputLanguage", async () => {
    await useSettingsStore.getState().setUiLanguage("tr");
    expect(useSettingsStore.getState().settings.uiLanguage).toBe("tr");
    expect(useSettingsStore.getState().settings.defaultOutputLanguage).toBe("en");
  });

  it("changing defaultOutputLanguage does not change uiLanguage", async () => {
    await useSettingsStore.getState().setDefaultOutputLanguage("tr");
    expect(useSettingsStore.getState().settings.defaultOutputLanguage).toBe("tr");
    expect(useSettingsStore.getState().settings.uiLanguage).toBe("en");
  });

  it("persists both fields independently to storage", async () => {
    await useSettingsStore.getState().setUiLanguage("tr");
    await useSettingsStore.getState().setDefaultOutputLanguage("en");
    const stored = readStoredSettings();
    expect(stored.uiLanguage).toBe("tr");
    expect(stored.defaultOutputLanguage).toBe("en");
  });
});

describe("reset and undo (FR-046/FR-049)", () => {
  it("resetToDefaults restores defaults and keeps an undo snapshot", async () => {
    await useSettingsStore.getState().setTheme("dark");
    await useSettingsStore.getState().setAutosaveEnabled(false);

    await useSettingsStore.getState().resetToDefaults();

    const state = useSettingsStore.getState();
    expect(state.settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(state.settings.autosaveEnabled).toBe(DEFAULT_SETTINGS.autosaveEnabled);
    expect(state.undoSnapshot?.theme).toBe("dark");
  });

  it("undoReset restores the pre-reset settings", async () => {
    await useSettingsStore.getState().setTheme("dark");
    await useSettingsStore.getState().resetToDefaults();
    await useSettingsStore.getState().undoReset();

    expect(useSettingsStore.getState().settings.theme).toBe("dark");
    expect(useSettingsStore.getState().undoSnapshot).toBeNull();
  });
});

describe("local data scoping (FR-046)", () => {
  it("clearAllLocalData only removes devflow: namespaced keys", async () => {
    window.localStorage.setItem("some-other-app:key", "keep-me");
    await useSettingsStore.getState().setTheme("dark");

    await useSettingsStore.getState().clearAllLocalData();

    expect(window.localStorage.getItem("some-other-app:key")).toBe("keep-me");
    expect(readStoredSettings()).toBeNull();
    expect(useSettingsStore.getState().settings.theme).toBe(DEFAULT_SETTINGS.theme);
  });

  it("exportLocalData returns only devflow: namespaced entries", async () => {
    window.localStorage.setItem("some-other-app:key", JSON.stringify("keep-me"));
    await useSettingsStore.getState().setTheme("dark");

    const exported = useSettingsStore.getState().exportLocalData();

    expect(Object.keys(exported)).toContain(SETTINGS_STORAGE_KEY);
    expect(Object.keys(exported)).not.toContain("some-other-app:key");
  });
});
