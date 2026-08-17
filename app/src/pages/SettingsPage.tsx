import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSettingsStore } from "../application/settingsStore";
import { downloadJson } from "../adapters/downloadJson";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { UndoToast } from "../components/UndoToast";
import { PageHeader } from "../components/layout/PageHeader";
import { SectionCard } from "../components/ui/SectionCard";
import { Button } from "../components/ui/Button";

const UNDO_TIMEOUT_MS = 8000;
const NOTICE_TIMEOUT_MS = 6000;

type PendingLocalDataAction = "reset" | "clear" | null;

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const settings = useSettingsStore((state) => state.settings);
  const undoSnapshot = useSettingsStore((state) => state.undoSnapshot);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setUiLanguage = useSettingsStore((state) => state.setUiLanguage);
  const setDefaultOutputLanguage = useSettingsStore((state) => state.setDefaultOutputLanguage);
  const setDefaultExperienceProfile = useSettingsStore(
    (state) => state.setDefaultExperienceProfile,
  );
  const setDefaultSelectionMode = useSettingsStore((state) => state.setDefaultSelectionMode);
  const setDefaultExecutionProfile = useSettingsStore((state) => state.setDefaultExecutionProfile);
  const setAutosaveEnabled = useSettingsStore((state) => state.setAutosaveEnabled);
  const setAiEnabled = useSettingsStore((state) => state.setAiEnabled);
  const resetToDefaults = useSettingsStore((state) => state.resetToDefaults);
  const undoReset = useSettingsStore((state) => state.undoReset);
  const exportLocalData = useSettingsStore((state) => state.exportLocalData);
  const clearAllLocalData = useSettingsStore((state) => state.clearAllLocalData);

  const [pendingAction, setPendingAction] = useState<PendingLocalDataAction>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const [clearedNoticeVisible, setClearedNoticeVisible] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  function handleExport(): void {
    downloadJson(`devflow-local-data-${Date.now()}.json`, exportLocalData());
  }

  async function handleConfirmReset(): Promise<void> {
    await resetToDefaults();
    setPendingAction(null);
    setUndoVisible(true);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoVisible(false), UNDO_TIMEOUT_MS);
  }

  async function handleUndo(): Promise<void> {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoVisible(false);
    await undoReset();
  }

  async function handleConfirmClear(): Promise<void> {
    downloadJson(`devflow-local-data-backup-${Date.now()}.json`, exportLocalData());
    await clearAllLocalData();
    setPendingAction(null);
    setClearedNoticeVisible(true);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setClearedNoticeVisible(false), NOTICE_TIMEOUT_MS);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("settings.title")} />

      <SectionCard title={t("settings.appearance.heading")} headingId="settings-appearance-heading">
        <label className="flex flex-col gap-1 text-sm text-text" htmlFor="theme-select">
          {t("settings.appearance.theme.label")}
          <select
            id="theme-select"
            value={settings.theme}
            onChange={(event) => void setTheme(event.target.value as typeof settings.theme)}
            className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-text"
          >
            <option value="light">{t("settings.appearance.theme.light")}</option>
            <option value="dark">{t("settings.appearance.theme.dark")}</option>
            <option value="system">{t("settings.appearance.theme.system")}</option>
          </select>
        </label>
      </SectionCard>

      <SectionCard title={t("settings.language.heading")} headingId="settings-language-heading">
        <label className="flex flex-col gap-1 text-sm text-text" htmlFor="ui-language-select">
          {t("settings.language.uiLabel")}
          <select
            id="ui-language-select"
            value={settings.uiLanguage}
            onChange={(event) =>
              void setUiLanguage(event.target.value as typeof settings.uiLanguage)
            }
            className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-text"
          >
            <option value="en">English</option>
            <option value="tr">Türkçe</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text" htmlFor="output-language-select">
          {t("settings.language.outputLabel")}
          <select
            id="output-language-select"
            value={settings.defaultOutputLanguage}
            onChange={(event) =>
              void setDefaultOutputLanguage(
                event.target.value as typeof settings.defaultOutputLanguage,
              )
            }
            className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-text"
          >
            <option value="en">English</option>
            <option value="tr">Türkçe</option>
          </select>
          <span className="text-xs text-muted">{t("settings.language.outputHelp")}</span>
        </label>
      </SectionCard>

      <SectionCard title={t("settings.defaults.heading")} headingId="settings-defaults-heading">
        <p className="text-xs text-muted">{t("settings.defaults.note")}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label
            className="flex flex-col gap-1 text-sm text-text"
            htmlFor="experience-profile-select"
          >
            {t("settings.defaults.experienceProfile.label")}
            <select
              id="experience-profile-select"
              value={settings.defaultExperienceProfile}
              onChange={(event) =>
                void setDefaultExperienceProfile(
                  event.target.value as typeof settings.defaultExperienceProfile,
                )
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-text"
            >
              <option value="beginner">{t("settings.defaults.experienceProfile.beginner")}</option>
              <option value="intermediate">
                {t("settings.defaults.experienceProfile.intermediate")}
              </option>
              <option value="advanced">{t("settings.defaults.experienceProfile.advanced")}</option>
              <option value="team">{t("settings.defaults.experienceProfile.team")}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-text" htmlFor="selection-mode-select">
            {t("settings.defaults.selectionMode.label")}
            <select
              id="selection-mode-select"
              value={settings.defaultSelectionMode}
              onChange={(event) =>
                void setDefaultSelectionMode(
                  event.target.value as typeof settings.defaultSelectionMode,
                )
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-text"
            >
              <option value="automatic">{t("settings.defaults.selectionMode.automatic")}</option>
              <option value="guided">{t("settings.defaults.selectionMode.guided")}</option>
              <option value="manual">{t("settings.defaults.selectionMode.manual")}</option>
            </select>
          </label>

          <label
            className="flex flex-col gap-1 text-sm text-text"
            htmlFor="execution-profile-select"
          >
            {t("settings.defaults.executionProfile.label")}
            <select
              id="execution-profile-select"
              value={settings.defaultExecutionProfile}
              onChange={(event) =>
                void setDefaultExecutionProfile(
                  event.target.value as typeof settings.defaultExecutionProfile,
                )
              }
              className="rounded-md border border-border bg-background px-3 py-2 text-text"
            >
              <option value="economic">{t("settings.defaults.executionProfile.economic")}</option>
              <option value="balanced">{t("settings.defaults.executionProfile.balanced")}</option>
              <option value="comprehensive">
                {t("settings.defaults.executionProfile.comprehensive")}
              </option>
            </select>
          </label>

          <div className="flex flex-col justify-end gap-1">
            <label
              className="flex items-center gap-2 text-sm text-text"
              htmlFor="autosave-checkbox"
            >
              <input
                id="autosave-checkbox"
                type="checkbox"
                checked={settings.autosaveEnabled}
                onChange={(event) => void setAutosaveEnabled(event.target.checked)}
              />
              {t("settings.defaults.autosave.label")}
            </label>
            <span className="text-xs text-muted">{t("settings.defaults.autosave.help")}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t("settings.ai.heading")} headingId="settings-ai-heading">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("settings.ai.whatEnablingDoesHeading")}
          </p>
          <p className="text-sm text-muted">{t("settings.ai.help")}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("settings.ai.howItWorksHeading")}
          </p>
          <p className="max-w-2xl text-sm text-muted">{t("settings.ai.consentNotice")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-text" htmlFor="ai-enabled-checkbox">
          <input
            id="ai-enabled-checkbox"
            type="checkbox"
            checked={settings.ai.enabled}
            onChange={(event) => void setAiEnabled(event.target.checked)}
          />
          {t("settings.ai.enableLabel")}
        </label>
        {settings.ai.enabled && settings.ai.consentAcceptedAt && (
          <p className="text-xs text-muted">
            {t("settings.ai.consentAcceptedAt", {
              date: new Date(settings.ai.consentAcceptedAt).toLocaleString(i18n.language),
            })}
          </p>
        )}
      </SectionCard>

      <SectionCard title={t("settings.localData.heading")} headingId="settings-local-data-heading">
        <div className="flex flex-col gap-2">
          <Button variant="secondary" className="w-fit" onClick={handleExport}>
            {t("settings.localData.export.label")}
          </Button>
          <span className="text-xs text-muted">{t("settings.localData.export.description")}</span>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="secondary" className="w-fit" onClick={() => setPendingAction("reset")}>
            {t("settings.localData.reset.label")}
          </Button>
          <span className="text-xs text-muted">{t("settings.localData.reset.description")}</span>
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-danger/40 bg-danger/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-danger">
            {t("settings.localData.dangerZoneHeading")}
          </p>
          <Button variant="danger" className="w-fit" onClick={() => setPendingAction("clear")}>
            {t("settings.localData.clear.label")}
          </Button>
          <span className="text-xs text-muted">{t("settings.localData.clear.description")}</span>
        </div>

        {clearedNoticeVisible && (
          <p role="status" className="text-xs text-muted">
            {t("settings.localData.clear.exportedNotice")}
          </p>
        )}
      </SectionCard>

      <ConfirmDialog
        open={pendingAction === "reset"}
        title={t("settings.localData.reset.confirmTitle")}
        body={t("settings.localData.reset.confirmBody")}
        onConfirm={() => void handleConfirmReset()}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={pendingAction === "clear"}
        title={t("settings.localData.clear.confirmTitle")}
        body={t("settings.localData.clear.confirmBody")}
        destructive
        onConfirm={() => void handleConfirmClear()}
        onCancel={() => setPendingAction(null)}
      />

      {undoVisible && undoSnapshot && (
        <UndoToast
          message={t("settings.localData.reset.confirmTitle")}
          actionLabel={t("settings.localData.reset.undo")}
          onAction={() => void handleUndo()}
        />
      )}
    </div>
  );
}
