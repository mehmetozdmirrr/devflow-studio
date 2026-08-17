import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { Project } from "@contracts/project";

import { useProjectsStore } from "../../../application/projectsStore";
import { SYSTEM_DOMAINS } from "../../../domain/domains";
import {
  WIZARD_STEP_LABEL_KEYS,
  getVisibleSteps,
  type WizardCompletenessResult,
} from "../../../domain/wizardSteps";
import { Button, actionLinkClasses } from "../../../components/ui/Button";

interface ReviewStepProps {
  project: Project;
  completeness: WizardCompletenessResult;
}

/** FR-015: read-only summary, incomplete-section list with edit links, and the only place that marks the project "configured". */
export function ReviewStep({ project, completeness }: ReviewStepProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const markConfigured = useProjectsStore((state) => state.markConfigured);
  const locale = i18n.language === "tr" ? "tr" : "en";

  const domainLabels = [
    ...project.configuration.domainIds.map(
      (id) => SYSTEM_DOMAINS.find((domain) => domain.id === id)?.name[locale] ?? id,
    ),
    ...project.configuration.customDomainIds.map(
      (id) => project.configuration.customDomainLabels[id] ?? id,
    ),
  ];

  async function handleMarkConfigured(): Promise<void> {
    const result = await markConfigured(project.id);
    if (result?.ok) {
      navigate(`/projects/${project.id}`);
    }
  }

  const dataSteps = getVisibleSteps().filter((step) => step.id !== "review");

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">{t("wizard.review.description")}</p>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase text-muted">
            {t("wizard.review.nameLabel")}
          </dt>
          <dd className="text-text">{project.meta.name || t("wizard.review.none")}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-muted">
            {t("wizard.review.profileLabel")}
          </dt>
          <dd className="text-text">
            {t(`settings.defaults.experienceProfile.${project.configuration.experienceProfile}`)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-muted">
            {t("wizard.review.domainsLabel")}
          </dt>
          <dd className="text-text">
            {domainLabels.length > 0 ? domainLabels.join(", ") : t("wizard.review.none")}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-muted">
            {t("wizard.review.requirementsLabel")}
          </dt>
          <dd className="text-text">
            {t("wizard.review.requirementsCount", { count: project.requirements.length })}
          </dd>
        </div>
      </dl>

      {completeness.incompleteStepIds.length > 0 ? (
        <div role="alert" className="rounded-md border border-danger bg-danger/10 p-3">
          <p className="text-sm font-medium text-danger">{t("wizard.review.incompleteHeading")}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {completeness.incompleteStepIds.map((stepId) => (
              <li key={stepId}>
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${project.id}/wizard/${stepId}`)}
                  className="text-sm font-medium text-danger underline-offset-2 hover:underline"
                >
                  {t(WIZARD_STEP_LABEL_KEYS[stepId])}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p role="status" className="text-sm text-success">
          {t("wizard.review.readyNotice")}
        </p>
      )}

      <ul className="flex flex-col gap-1">
        {dataSteps.map((step) => (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => navigate(`/projects/${project.id}/wizard/${step.id}`)}
              className={actionLinkClasses("primary")}
            >
              {t("wizard.review.editSection", { section: t(WIZARD_STEP_LABEL_KEYS[step.id]) })}
            </button>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="primary"
        className="w-fit"
        onClick={() => void handleMarkConfigured()}
        disabled={!completeness.readyToConfigure}
      >
        {t("wizard.review.markConfiguredAction")}
      </Button>
    </div>
  );
}
