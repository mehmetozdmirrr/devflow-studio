import { useTranslation } from "react-i18next";
import type { ExperienceProfile } from "@contracts/common";
import type { Project } from "@contracts/project";

import { useProjectsStore } from "../../../application/projectsStore";
import {
  EXPERIENCE_PROFILE_IDS,
  getExperienceProfileRules,
  reconcileProfileDefaults,
} from "../../../domain/experienceProfiles";

interface ProfileStepProps {
  project: Project;
}

/** FR-008/009: profile choice; selection/execution defaults reconcile without overwriting a user's confirmed choice (AC-007). */
export function ProfileStep({ project }: ProfileStepProps) {
  const { t } = useTranslation();
  const updateProjectDraft = useProjectsStore((state) => state.updateProjectDraft);

  function handleSelect(profile: ExperienceProfile): void {
    if (profile === project.configuration.experienceProfile) return;
    const reconciled = reconcileProfileDefaults(
      project.configuration,
      project.configuration.experienceProfile,
      profile,
    );
    updateProjectDraft(project.id, {
      configuration: { ...reconciled, experienceProfile: profile },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("wizard.profile.description")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {EXPERIENCE_PROFILE_IDS.map((profile) => {
          const rules = getExperienceProfileRules(profile);
          const selected = project.configuration.experienceProfile === profile;
          return (
            <button
              key={profile}
              type="button"
              onClick={() => handleSelect(profile)}
              aria-pressed={selected}
              className={`flex flex-col gap-2 rounded-lg border p-4 text-left ${
                selected
                  ? "border-primary-interactive bg-primary-interactive/10"
                  : "border-border bg-surface hover:bg-background"
              }`}
            >
              <span className="text-base font-semibold text-text">
                {t(`settings.defaults.experienceProfile.${profile}`)}
              </span>
              <span className="text-sm text-muted">{t(`wizard.profile.summary.${profile}`)}</span>
              <span className="text-xs text-muted">
                {t("wizard.profile.limits", {
                  agents: rules.defaultAgentLimit,
                  skills: rules.defaultSkillLimit,
                })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
