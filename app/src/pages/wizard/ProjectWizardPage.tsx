import { useEffect, useRef, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";

import { useProjectsStore } from "../../application/projectsStore";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { WizardStepRail } from "../../components/WizardStepRail";
import { InspectorPanel, MainPane, WorkspaceGrid } from "../../components/layout/WorkspaceGrid";
import { Button } from "../../components/ui/Button";
import {
  evaluateWizardCompleteness,
  getAdjacentStepId,
  getDisplayIndex,
  getStepCount,
  isStepComplete,
  type WizardStepId,
} from "../../domain/wizardSteps";

import { IdentityStep } from "./steps/IdentityStep";
import { ProfileStep } from "./steps/ProfileStep";
import { DomainsStep } from "./steps/DomainsStep";
import { PlatformsScopeStep } from "./steps/PlatformsScopeStep";
import { FunctionalRequirementsStep } from "./steps/FunctionalRequirementsStep";
import { DataIntegrationsStep } from "./steps/DataIntegrationsStep";
import { QualitySecurityStep } from "./steps/QualitySecurityStep";
import { SelectionExecutionStep } from "./steps/SelectionExecutionStep";
import { RecommendationsStep } from "./steps/RecommendationsStep";
import { ReviewStep } from "./steps/ReviewStep";

const KNOWN_STEP_IDS = new Set<WizardStepId>([
  "identity",
  "profile",
  "domains",
  "platformsScope",
  "functionalRequirements",
  "dataIntegrations",
  "qualitySecurity",
  "selectionExecution",
  "recommendations",
  "review",
]);

/** Steps whose own Continue button is blocked while incomplete — AC-008 requires this for domains; identity mirrors first-creation's required-field behavior. Other steps stay freely revisitable per FLOW-001; final completeness is still enforced at Review before "Mark configured". */
const HARD_BLOCKING_STEPS: WizardStepId[] = ["identity", "domains"];

export function ProjectWizardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectId, stepId } = useParams<{ projectId: string; stepId: string }>();

  const hydrated = useProjectsStore((state) => state.hydrated);
  const loadError = useProjectsStore((state) => state.loadError);
  const hydrate = useProjectsStore((state) => state.hydrate);
  const project = useProjectsStore((state) =>
    state.projects.find((candidate) => candidate.id === projectId),
  );
  const saveProjectNow = useProjectsStore((state) => state.saveProjectNow);

  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  // Keying only on `stepId` misses the very first landing on a step: while `!hydrated` or
  // `!project` is still true, this effect fires with `headingRef.current` null (the heading
  // isn't mounted yet — a Loading/EmptyState renders instead), and once hydration completes
  // `stepId` hasn't changed, so the effect never re-runs and focus is silently lost. `ready` is a
  // stable boolean (not the `project` object identity, which changes on every keystroke) so this
  // still only re-fires on an actual step change or the loading->loaded transition.
  const ready = hydrated && Boolean(project);
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepId, ready]);

  if (!hydrated) {
    return <LoadingState />;
  }

  if (loadError) {
    return <ErrorState body={t("pages.projects.errorBody")} onRetry={() => void hydrate()} />;
  }

  if (!project) {
    return (
      <EmptyState
        title={t("pages.projectOverview.notFoundTitle")}
        body={t("pages.projectOverview.notFoundBody")}
        action={
          <Link
            to="/projects"
            className="font-medium text-primary-text underline-offset-2 hover:underline"
          >
            {t("pages.projectOverview.backToProjects")}
          </Link>
        }
      />
    );
  }

  const currentStepId: WizardStepId =
    stepId && KNOWN_STEP_IDS.has(stepId as WizardStepId) ? (stepId as WizardStepId) : "identity";
  const completeness = evaluateWizardCompleteness(project);
  const previousStepId = getAdjacentStepId(currentStepId, "previous");
  const nextStepId = getAdjacentStepId(currentStepId, "next");
  const canContinue =
    !HARD_BLOCKING_STEPS.includes(currentStepId) || isStepComplete(currentStepId, project);

  function goToStep(id: WizardStepId): void {
    navigate(`/projects/${project?.id}/wizard/${id}`);
  }

  async function handleSaveAndExit(): Promise<void> {
    await saveProjectNow(project?.id ?? "");
    navigate(`/projects/${project?.id}`);
  }

  function renderStep(): ReactNode {
    if (!project) return null;
    switch (currentStepId) {
      case "identity":
        return <IdentityStep project={project} />;
      case "profile":
        return <ProfileStep project={project} />;
      case "domains":
        return <DomainsStep project={project} />;
      case "platformsScope":
        return <PlatformsScopeStep project={project} />;
      case "functionalRequirements":
        return <FunctionalRequirementsStep project={project} />;
      case "dataIntegrations":
        return <DataIntegrationsStep project={project} />;
      case "qualitySecurity":
        return <QualitySecurityStep project={project} />;
      case "selectionExecution":
        return <SelectionExecutionStep project={project} />;
      case "recommendations":
        return <RecommendationsStep project={project} />;
      case "review":
        return <ReviewStep project={project} completeness={completeness} />;
      default:
        return null;
    }
  }

  return (
    <WorkspaceGrid>
      <InspectorPanel width="sm" aria-label={t("wizard.stepRailLabel")}>
        <WizardStepRail
          currentStepId={currentStepId}
          stepStatus={completeness.stepStatus}
          errorStepIds={completeness.incompleteStepIds}
          onStepSelect={goToStep}
        />
      </InspectorPanel>

      <MainPane>
        <div>
          <p className="text-sm text-muted">
            {t("wizard.stepProgress", {
              current: getDisplayIndex(currentStepId),
              total: getStepCount(),
            })}
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold text-text outline-none"
          >
            {t(`wizard.steps.${currentStepId}`)}
          </h1>
        </div>

        {renderStep()}

        <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
          <div>
            {previousStepId && (
              <Button variant="secondary" onClick={() => goToStep(previousStepId)}>
                {t("wizard.actions.back")}
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => void handleSaveAndExit()}>
              {t("wizard.actions.saveAndExit")}
            </Button>
            {nextStepId && (
              <Button
                variant="primary"
                disabled={!canContinue}
                onClick={() => goToStep(nextStepId)}
              >
                {t("wizard.actions.continue")}
              </Button>
            )}
          </div>
        </div>
      </MainPane>
    </WorkspaceGrid>
  );
}
