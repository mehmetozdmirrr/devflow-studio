import { useTranslation } from "react-i18next";
import type { ProjectScale } from "@contracts/common";
import type { Project, ProjectConfiguration } from "@contracts/project";

import { useProjectsStore } from "../../../application/projectsStore";
import { TagListInput } from "../../../components/TagListInput";

interface PlatformsScopeStepProps {
  project: Project;
}

const SCALES: ProjectScale[] = ["prototype", "mvp", "standard", "enterprise"];

/** FR-013: target platforms, scale, connectivity, user model, data sensitivity. */
export function PlatformsScopeStep({ project }: PlatformsScopeStepProps) {
  const { t } = useTranslation();
  const updateProjectDraft = useProjectsStore((state) => state.updateProjectDraft);
  const { configuration } = project;

  function patch(configurationPatch: Partial<ProjectConfiguration>): void {
    updateProjectDraft(project.id, { configuration: configurationPatch });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <p className="text-sm text-muted">{t("wizard.platformsScope.description")}</p>

      <TagListInput
        id="wizard-platforms-input"
        label={t("wizard.platformsScope.platformsLabel")}
        values={configuration.targetPlatforms}
        onChange={(values) => patch({ targetPlatforms: values })}
        placeholder={t("wizard.platformsScope.platformsPlaceholder")}
      />

      <label className="flex flex-col gap-1 text-sm text-text" htmlFor="wizard-scale-select">
        {t("wizard.platformsScope.scaleLabel")}
        <select
          id="wizard-scale-select"
          value={configuration.projectScale}
          onChange={(event) => patch({ projectScale: event.target.value as ProjectScale })}
          className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-text"
        >
          {SCALES.map((scale) => (
            <option key={scale} value={scale}>
              {t(`wizard.platformsScope.scale.${scale}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-text" htmlFor="wizard-connectivity-select">
        {t("wizard.platformsScope.connectivityLabel")}
        <select
          id="wizard-connectivity-select"
          value={configuration.connectivity}
          onChange={(event) =>
            patch({ connectivity: event.target.value as ProjectConfiguration["connectivity"] })
          }
          className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-text"
        >
          <option value="online">{t("wizard.platformsScope.connectivity.online")}</option>
          <option value="offline">{t("wizard.platformsScope.connectivity.offline")}</option>
          <option value="hybrid">{t("wizard.platformsScope.connectivity.hybrid")}</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-text" htmlFor="wizard-user-model-select">
        {t("wizard.platformsScope.userModelLabel")}
        <select
          id="wizard-user-model-select"
          value={configuration.userModel}
          onChange={(event) =>
            patch({ userModel: event.target.value as ProjectConfiguration["userModel"] })
          }
          className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-text"
        >
          <option value="single-user">{t("wizard.platformsScope.userModel.single")}</option>
          <option value="multi-user">{t("wizard.platformsScope.userModel.multi")}</option>
        </select>
      </label>

      <TagListInput
        id="wizard-data-sensitivity-input"
        label={t("wizard.platformsScope.dataSensitivityLabel")}
        values={configuration.dataSensitivity}
        onChange={(values) => patch({ dataSensitivity: values })}
        placeholder={t("wizard.platformsScope.dataSensitivityPlaceholder")}
      />
    </div>
  );
}
