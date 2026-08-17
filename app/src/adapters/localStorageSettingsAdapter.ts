import type { UserSettings } from "@contracts/settings";
import type { SettingsRepository } from "../ports/settingsRepository";
import { cloneDefaultSettings } from "../domain/settings";

export const DEVFLOW_NAMESPACE_PREFIX = "devflow:";
export const SETTINGS_STORAGE_KEY = `${DEVFLOW_NAMESPACE_PREFIX}settings`;

function isUserSettingsShape(value: unknown): value is UserSettings {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    "uiLanguage" in value &&
    "theme" in value
  );
}

export class LocalStorageSettingsAdapter implements SettingsRepository {
  async get(): Promise<UserSettings> {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return cloneDefaultSettings();
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isUserSettingsShape(parsed)) {
        return cloneDefaultSettings();
      }
      return { ...cloneDefaultSettings(), ...parsed };
    } catch {
      return cloneDefaultSettings();
    }
  }

  async save(settings: UserSettings): Promise<UserSettings> {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return settings;
  }

  async reset(): Promise<UserSettings> {
    const defaults = cloneDefaultSettings();
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
}

function namespacedKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(DEVFLOW_NAMESPACE_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

export function exportNamespacedLocalData(): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const key of namespacedKeys()) {
    const raw = window.localStorage.getItem(key);
    if (raw === null) continue;
    try {
      snapshot[key] = JSON.parse(raw);
    } catch {
      snapshot[key] = raw;
    }
  }
  return snapshot;
}

export function clearNamespacedLocalData(): void {
  for (const key of namespacedKeys()) {
    window.localStorage.removeItem(key);
  }
}
