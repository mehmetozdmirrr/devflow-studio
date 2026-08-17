import { useTranslation } from "react-i18next";
import type { Project, ProjectBrief, ProjectConfiguration } from "@contracts/project";

import { useProjectsStore } from "../../../application/projectsStore";
import { TagListInput } from "../../../components/TagListInput";
import { getVisibleConditionalPrompts } from "../../../domain/wizardSteps";

interface DataIntegrationsStepProps {
  project: Project;
}

/** FR-013 data/integration capture + FR-012 conditional prompts (visibility-only, never mutates data by itself). */
export function DataIntegrationsStep({ project }: DataIntegrationsStepProps) {
  const { t } = useTranslation();
  const updateProjectDraft = useProjectsStore((state) => state.updateProjectDraft);
  const { brief, configuration } = project;

  function patchBrief(
    briefPatch: Partial<
      Pick<ProjectBrief, "targetUsers" | "goals" | "successMeasures" | "constraints">
    >,
  ): void {
    updateProjectDraft(project.id, { brief: briefPatch });
  }

  function patchConfiguration(configurationPatch: Partial<ProjectConfiguration>): void {
    updateProjectDraft(project.id, { configuration: configurationPatch });
  }

  const visiblePrompts = getVisibleConditionalPrompts(configuration.domainIds);

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <p className="text-sm text-muted">{t("wizard.dataIntegrations.description")}</p>

      <TagListInput
        id="wizard-target-users-input"
        label={t("wizard.dataIntegrations.targetUsersLabel")}
        values={brief.targetUsers}
        onChange={(values) => patchBrief({ targetUsers: values })}
      />
      <TagListInput
        id="wizard-goals-input"
        label={t("wizard.dataIntegrations.goalsLabel")}
        values={brief.goals}
        onChange={(values) => patchBrief({ goals: values })}
      />
      <TagListInput
        id="wizard-success-measures-input"
        label={t("wizard.dataIntegrations.successMeasuresLabel")}
        values={brief.successMeasures}
        onChange={(values) => patchBrief({ successMeasures: values })}
      />
      <TagListInput
        id="wizard-constraints-input"
        label={t("wizard.dataIntegrations.constraintsLabel")}
        values={brief.constraints}
        onChange={(values) => patchBrief({ constraints: values })}
      />
      <TagListInput
        id="wizard-capabilities-input"
        label={t("wizard.dataIntegrations.capabilitiesLabel")}
        values={configuration.enabledCapabilities}
        onChange={(values) => patchConfiguration({ enabledCapabilities: values })}
      />
      <TagListInput
        id="wizard-forbidden-input"
        label={t("wizard.dataIntegrations.forbiddenLabel")}
        values={configuration.forbiddenTechnologies}
        onChange={(values) => patchConfiguration({ forbiddenTechnologies: values })}
      />

      {visiblePrompts.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-sm font-medium text-text">
            {t("wizard.dataIntegrations.conditionalHeading")}
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {visiblePrompts.map((prompt) => (
              <li key={prompt.id}>{t(`wizard.dataIntegrations.conditionalPrompt.${prompt.id}`)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
