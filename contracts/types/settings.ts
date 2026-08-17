import type {
  ExecutionProfile,
  ExperienceProfile,
  Identifier,
  ISODateTimeString,
  Locale,
  SelectionMode,
  ThemeMode,
} from "./common";

export interface AIUserSettings {
  enabled: boolean;
  consentAcceptedAt?: ISODateTimeString;
  consentNoticeVersion?: string;
}

export interface UserSettings {
  schemaVersion: number;
  uiLanguage: Locale;
  defaultOutputLanguage: Locale;
  theme: ThemeMode;
  defaultExperienceProfile: ExperienceProfile;
  defaultSelectionMode: SelectionMode;
  defaultExecutionProfile: ExecutionProfile;
  autosaveEnabled: boolean;
  projectView: "cards" | "table";
  favoriteCatalogItemIds: Identifier[];
  ai: AIUserSettings;
}

