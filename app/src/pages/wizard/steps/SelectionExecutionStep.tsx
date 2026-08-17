import { useTranslation } from "react-i18next";
import type { ExecutionProfile, SelectionMode } from "@contracts/common";
import type { Project } from "@contracts/project";

import { useProjectsStore } from "../../../application/projectsStore";

interface SelectionExecutionStepProps {
  project: Project;
}

const SELECTION_MODES: SelectionMode[] = ["automatic", "guided", "manual"];
const EXECUTION_PROFILES: ExecutionProfile[] = ["economic", "balanced", "comprehensive"];

/** FR-016/AC-010: selection mode and execution profile are independent controls, never conflated. */
export function SelectionExecutionStep({ project }: SelectionExecutionStepProps) {
  const { t } = useTranslation();
  const updateProjectDraft = useProjectsStore((state) => state.updateProjectDraft);
  const { configuration } = project;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <p className="text-sm text-muted">{t("wizard.selectionExecution.description")}</p>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-text">
          {t("wizard.selectionExecution.selectionModeLabel")}
        </legend>
        <div className="flex flex-col gap-2">
          {SELECTION_MODES.map((mode) => (
            <label
              key={mode}
              className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
            >
              <input
                type="radio"
                name="wizard-selection-mode"
                checked={configuration.selectionMode === mode}
                onChange={() =>
                  updateProjectDraft(project.id, { configuration: { selectionMode: mode } })
                }
              />
              {t(`settings.defaults.selectionMode.${mode}`)}
            </label>
          ))}
        </div>
        {configuration.selectionMode === "automatic" && (
          <p className="text-xs text-muted">{t("wizard.selectionExecution.automaticNote")}</p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-text">
          {t("wizard.selectionExecution.executionProfileLabel")}
        </legend>
        <div className="flex flex-col gap-2">
          {EXECUTION_PROFILES.map((profile) => (
            <label
              key={profile}
              className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
            >
              <input
                type="radio"
                name="wizard-execution-profile"
                checked={configuration.executionProfile === profile}
                onChange={() =>
                  updateProjectDraft(project.id, { configuration: { executionProfile: profile } })
                }
              />
              {t(`settings.defaults.executionProfile.${profile}`)}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
