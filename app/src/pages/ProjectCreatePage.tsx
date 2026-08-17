import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import type { ExperienceProfile } from "@contracts/common";

import { useProjectsStore } from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import { IdentityFields } from "../components/IdentityFields";
import { PageHeader } from "../components/layout/PageHeader";
import { PageContainer } from "../components/layout/PageContainer";
import { SectionCard } from "../components/ui/SectionCard";
import { Button } from "../components/ui/Button";
import type { ProjectFieldErrors } from "../domain/project";

const EXPERIENCE_PROFILES: ExperienceProfile[] = ["beginner", "intermediate", "advanced", "team"];

export function ProjectCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createProject = useProjectsStore((state) => state.createProject);
  const defaultExperienceProfile = useSettingsStore(
    (state) => state.settings.defaultExperienceProfile,
  );

  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [problem, setProblem] = useState("");
  const [proposedSolution, setProposedSolution] = useState("");
  const [experienceProfile, setExperienceProfile] =
    useState<ExperienceProfile>(defaultExperienceProfile);
  const [errors, setErrors] = useState<ProjectFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    const result = await createProject({
      name,
      idea,
      problem,
      proposedSolution,
      experienceProfile,
    });
    setSubmitting(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    navigate(`/projects/${result.project.id}/wizard/profile`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("pages.projectCreate.title")} />
      <PageContainer width="narrow" className="mx-auto flex flex-col gap-4">
        <SectionCard>
          <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
            <IdentityFields
              idPrefix="project"
              name={name}
              idea={idea}
              problem={problem}
              proposedSolution={proposedSolution}
              errors={errors}
              onNameChange={setName}
              onIdeaChange={setIdea}
              onProblemChange={setProblem}
              onProposedSolutionChange={setProposedSolution}
            />

            <label
              className="flex flex-col gap-1 text-sm text-text"
              htmlFor="project-experience-select"
            >
              {t("pages.projectCreate.experienceProfileLabel")}
              <select
                id="project-experience-select"
                value={experienceProfile}
                onChange={(event) => setExperienceProfile(event.target.value as ExperienceProfile)}
                className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-text"
              >
                {EXPERIENCE_PROFILES.map((profile) => (
                  <option key={profile} value={profile}>
                    {t(`settings.defaults.experienceProfile.${profile}`)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex gap-3">
              <Button type="submit" variant="primary" disabled={submitting}>
                {t("pages.projectCreate.submit")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate("/projects")}>
                {t("pages.projectCreate.cancel")}
              </Button>
            </div>
          </form>
        </SectionCard>

        <div className="flex flex-col gap-1 px-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("pages.projectCreate.nextStepsHeading")}
          </p>
          <ol className="flex flex-col gap-0.5 text-xs text-muted">
            <li>{t("pages.projectCreate.nextStepsItem1")}</li>
            <li>{t("pages.projectCreate.nextStepsItem2")}</li>
            <li>{t("pages.projectCreate.nextStepsItem3")}</li>
          </ol>
        </div>
      </PageContainer>
    </div>
  );
}
