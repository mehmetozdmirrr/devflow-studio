import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "../pages/SettingsPage";
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
    hydrated: true,
    undoSnapshot: null,
  });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SettingsPage — all nine FR-046 controls are present", () => {
  it("renders theme, language, defaults, AI, and local-data controls", () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText(/Theme/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Interface language/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Generated package language/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Default experience profile/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Default selection mode/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Default execution profile/)).toBeInTheDocument();
    expect(screen.getByLabelText("Autosave")).toBeInTheDocument();
    expect(screen.getByLabelText("Enable optional AI assistance")).toBeInTheDocument();
    expect(screen.getByText("Export local data")).toBeInTheDocument();
    expect(screen.getByText("Reset settings to defaults")).toBeInTheDocument();
    expect(screen.getByText("Clear all local DevFlow data")).toBeInTheDocument();
  });
});

describe("SettingsPage — controls persist", () => {
  it("theme, language, defaults, and autosave changes persist to storage", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    // Capture every control before switching UI language, since that
    // re-renders labels in Turkish and would break later English lookups.
    const themeSelect = screen.getByLabelText(/Theme/);
    const uiLanguageSelect = screen.getByLabelText(/Interface language/);
    const outputLanguageSelect = screen.getByLabelText(/Generated package language/);
    const experienceProfileSelect = screen.getByLabelText(/Default experience profile/);
    const selectionModeSelect = screen.getByLabelText(/Default selection mode/);
    const executionProfileSelect = screen.getByLabelText(/Default execution profile/);
    const autosaveCheckbox = screen.getByLabelText("Autosave");

    await user.selectOptions(themeSelect, "dark");
    await user.selectOptions(outputLanguageSelect, "tr");
    await user.selectOptions(experienceProfileSelect, "advanced");
    await user.selectOptions(selectionModeSelect, "manual");
    await user.selectOptions(executionProfileSelect, "comprehensive");
    await user.click(autosaveCheckbox);
    await user.selectOptions(uiLanguageSelect, "tr");

    await waitFor(() => {
      const stored = readStoredSettings();
      expect(stored.theme).toBe("dark");
      expect(stored.uiLanguage).toBe("tr");
      expect(stored.defaultOutputLanguage).toBe("tr");
      expect(stored.defaultExperienceProfile).toBe("advanced");
      expect(stored.defaultSelectionMode).toBe("manual");
      expect(stored.defaultExecutionProfile).toBe("comprehensive");
      expect(stored.autosaveEnabled).toBe(false);
    });
  });
});

describe("SettingsPage — AI setting never calls the network", () => {
  it("enabling and disabling AI assistance persists locally without any fetch/XHR call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const xhrOpenSpy = vi.spyOn(XMLHttpRequest.prototype, "open");

    const user = userEvent.setup();
    render(<SettingsPage />);

    const aiCheckbox = screen.getByLabelText("Enable optional AI assistance");
    await user.click(aiCheckbox);

    await waitFor(() => {
      expect(readStoredSettings().ai.enabled).toBe(true);
    });
    expect(screen.getByText(/Consent recorded at/)).toBeInTheDocument();

    await user.click(aiCheckbox);
    await waitFor(() => {
      expect(readStoredSettings().ai.enabled).toBe(false);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpenSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});

describe("SettingsPage — local data management (FR-046/FR-049)", () => {
  it("exports local data as a downloaded JSON file", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByText("Export local data"));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it("resets settings only after confirmation, and undo restores the previous values", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.selectOptions(screen.getByLabelText(/Theme/), "dark");
    await waitFor(() => expect(readStoredSettings().theme).toBe("dark"));

    await user.click(screen.getByText("Reset settings to defaults"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("dialog").querySelector("button:last-child")!);

    await waitFor(() => expect(readStoredSettings().theme).toBe(DEFAULT_SETTINGS.theme));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const undoButton = await screen.findByText("Undo");
    await user.click(undoButton);

    await waitFor(() => expect(readStoredSettings().theme).toBe("dark"));
  });

  it("requires confirmation before clearing, downloads a backup first, and scopes the clear to the devflow namespace", async () => {
    window.localStorage.setItem("some-other-app:key", "keep-me");
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByText("Clear all local DevFlow data"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    await user.click(dialog.querySelector("button:last-child")!);

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(readStoredSettings()).toBeNull();
    });
    expect(window.localStorage.getItem("some-other-app:key")).toBe("keep-me");
    expect(await screen.findByText("A backup was downloaded before clearing.")).toBeInTheDocument();
  });
});
