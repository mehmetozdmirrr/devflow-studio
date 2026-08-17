import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type { Project } from "@contracts/project";

import { useProjectsStore } from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import { selectAllCatalogItems, useCatalogStore } from "../application/catalogStore";
import { computeValidation, useRecommendationsStore } from "../application/recommendationsStore";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { RequirementsPanel } from "../components/RequirementsPanel";
import { PageHeader } from "../components/layout/PageHeader";
import { MainPane, WorkspaceGrid, InspectorPanel } from "../components/layout/WorkspaceGrid";
import {
  PROJECT_STATUS_LABEL_KEYS,
  PROJECT_STATUS_TONES,
} from "../components/layout/projectStatusBadge";
import { SectionCard } from "../components/ui/SectionCard";
import { Badge } from "../components/ui/Badge";
import { Button, actionLinkClasses, buttonClasses } from "../components/ui/Button";
import { computeResumeStepId } from "../domain/wizardSteps";

type PendingAction = "archive" | "unarchive" | "trash" | null;

export function ProjectOverviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const hydrated = useProjectsStore((state) => state.hydrated);
  const loadError = useProjectsStore((state) => state.loadError);
  const hydrate = useProjectsStore((state) => state.hydrate);
  const project = useProjectsStore((state) =>
    state.projects.find((candidate) => candidate.id === projectId),
  );
  const dirty = useProjectsStore((state) =>
    projectId ? state.dirtyProjectIds.has(projectId) : false,
  );
  const saveError = useProjectsStore((state) =>
    projectId ? state.saveErrorsByProjectId[projectId] : undefined,
  );
  const updateProjectDraft = useProjectsStore((state) => state.updateProjectDraft);
  const saveProjectNow = useProjectsStore((state) => state.saveProjectNow);
  const cloneProject = useProjectsStore((state) => state.cloneProject);
  const archiveProject = useProjectsStore((state) => state.archiveProject);
  const unarchiveProject = useProjectsStore((state) => state.unarchiveProject);
  const trashProject = useProjectsStore((state) => state.trashProject);
  const autosaveEnabled = useSettingsStore((state) => state.settings.autosaveEnabled);

  const catalogHydrated = useCatalogStore((state) => state.hydrated);
  const hydrateCatalog = useCatalogStore((state) => state.hydrate);
  const catalogItems = useCatalogStore(useShallow(selectAllCatalogItems));
  const removeSelectionItem = useRecommendationsStore((state) => state.removeItem);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!catalogHydrated) void hydrateCatalog();
  }, [catalogHydrated, hydrateCatalog]);

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
          <Link to="/projects" className={actionLinkClasses("primary")}>
            {t("pages.projectOverview.backToProjects")}
          </Link>
        }
      />
    );
  }

  const id = project.id;
  const selections = project.selections;
  const acceptedSelections = project.selections.filter(
    (selection) => selection.decision === "accepted",
  );
  const removedCount = project.selections.filter(
    (selection) => selection.decision === "removed",
  ).length;
  const validation = catalogHydrated
    ? computeValidation(project, catalogItems)
    : project.validation;

  async function handleRemoveSelection(selection: Project["selections"][number]): Promise<void> {
    const item = selection.itemId
      ? catalogItems.find((candidate) => candidate.id === selection.itemId)
      : undefined;
    if (item) {
      await removeSelectionItem(id, item);
    } else {
      // Custom/manual entries have no catalog identity to mark "removed" against — detach outright.
      updateProjectDraft(id, { selections: selections.filter((s) => s.id !== selection.id) });
      await saveProjectNow(id);
    }
  }

  async function handleClone(): Promise<void> {
    const clone = await cloneProject(id);
    if (clone) navigate(`/projects/${clone.id}`);
  }

  async function handleConfirmAction(): Promise<void> {
    if (pendingAction === "archive") await archiveProject(id);
    if (pendingAction === "unarchive") await unarchiveProject(id);
    if (pendingAction === "trash") {
      await trashProject(id);
      navigate("/projects");
      return;
    }
    setPendingAction(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={project.meta.name}
        meta={
          <Badge tone={PROJECT_STATUS_TONES[project.status]}>
            {t(PROJECT_STATUS_LABEL_KEYS[project.status])}
          </Badge>
        }
      />

      <WorkspaceGrid>
        <MainPane>
          <SectionCard
            title={t("pages.projectOverview.detailsHeading")}
            headingId="overview-details-heading"
          >
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => event.preventDefault()}
              aria-labelledby="overview-details-heading"
            >
              <label
                className="flex flex-col gap-1 text-sm text-text"
                htmlFor="overview-name-input"
              >
                {t("pages.projectOverview.nameLabel")}
                <input
                  id="overview-name-input"
                  type="text"
                  value={project.meta.name}
                  onChange={(event) => updateProjectDraft(project.id, { name: event.target.value })}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-text"
                />
              </label>

              <label
                className="flex flex-col gap-1 text-sm text-text"
                htmlFor="overview-idea-input"
              >
                {t("pages.projectOverview.ideaLabel")}
                <textarea
                  id="overview-idea-input"
                  value={project.brief.idea}
                  onChange={(event) => updateProjectDraft(project.id, { idea: event.target.value })}
                  className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-text"
                />
              </label>

              <label
                className="flex flex-col gap-1 text-sm text-text"
                htmlFor="overview-problem-input"
              >
                {t("pages.projectOverview.problemLabel")}
                <textarea
                  id="overview-problem-input"
                  value={project.brief.problem}
                  onChange={(event) =>
                    updateProjectDraft(project.id, { problem: event.target.value })
                  }
                  className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-text"
                />
              </label>

              <label
                className="flex flex-col gap-1 text-sm text-text"
                htmlFor="overview-solution-input"
              >
                {t("pages.projectOverview.solutionLabel")}
                <textarea
                  id="overview-solution-input"
                  value={project.brief.proposedSolution}
                  onChange={(event) =>
                    updateProjectDraft(project.id, { proposedSolution: event.target.value })
                  }
                  className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-text"
                />
              </label>
            </form>
          </SectionCard>

          <SectionCard
            title={t("pages.projectOverview.requirementsHeading")}
            headingId="overview-requirements-heading"
          >
            <RequirementsPanel
              idPrefix="overview-requirement"
              requirements={project.requirements}
              allowedTypes={["functional", "non-functional", "constraint"]}
              onChange={(requirements) => updateProjectDraft(project.id, { requirements })}
            />
          </SectionCard>

          <SectionCard
            title={t("pages.projectOverview.selectionsHeading")}
            headingId="overview-selections-heading"
            actions={
              <Link
                to={`/projects/${project.id}/wizard/recommendations`}
                className={buttonClasses("secondary", "sm")}
              >
                {t("pages.projectOverview.manageSelectionsAction")}
              </Link>
            }
          >
            {acceptedSelections.length === 0 ? (
              <p className="text-sm text-muted">{t("pages.projectOverview.noSelections")}</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {acceptedSelections.map((selection) => (
                  <li
                    key={selection.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-background p-3 text-sm"
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-text">{selection.snapshot.name}</span>
                      <Badge tone="neutral">{t(`catalog.kind.${selection.snapshot.kind}`)}</Badge>
                      <span className="text-xs text-muted">
                        {t(`pages.projectOverview.selectionSource.${selection.source}`)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveSelection(selection)}
                      className={actionLinkClasses("danger", "sm")}
                    >
                      {t("pages.projectOverview.removeSelectionAction")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {removedCount > 0 && (
              <p className="text-xs text-muted">
                {t("pages.projectOverview.removedSelectionsNote", { count: removedCount })}
              </p>
            )}
          </SectionCard>
        </MainPane>

        <InspectorPanel aria-label={t("pages.projectOverview.inspectorLabel")}>
          <SectionCard title={t("pages.projectOverview.inspectorHeading")}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={PROJECT_STATUS_TONES[project.status]}>
                {t(PROJECT_STATUS_LABEL_KEYS[project.status])}
              </Badge>
              <div role="status" className="flex flex-wrap items-center gap-2 text-xs text-muted">
                {dirty ? (
                  <span>{t("pages.projectOverview.dirtyNotice")}</span>
                ) : (
                  autosaveEnabled && <span>{t("pages.projectOverview.autosaveNotice")}</span>
                )}
                {saveError === "invalid" && (
                  <span className="text-danger">{t("pages.projectOverview.saveErrorInvalid")}</span>
                )}
                {saveError === "storage" && (
                  <span className="text-danger">{t("pages.projectOverview.saveErrorStorage")}</span>
                )}
              </div>
            </div>
            {!autosaveEnabled && dirty && (
              <Button
                variant="primary"
                size="sm"
                className="w-fit"
                onClick={() => void saveProjectNow(project.id)}
              >
                {t("pages.projectOverview.saveAction")}
              </Button>
            )}

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("pages.projectOverview.workflowHeading")}
              </h3>
              <Button
                variant="primary"
                onClick={() =>
                  navigate(`/projects/${project.id}/wizard/${computeResumeStepId(project)}`)
                }
              >
                {project.status === "draft"
                  ? t("pages.projectOverview.continueConfiguration")
                  : t("pages.projectOverview.editConfiguration")}
              </Button>
              <Link to={`/projects/${project.id}/ai`} className={buttonClasses("secondary")}>
                {t("pages.projectOverview.aiAnalysisAction")}
              </Link>
              <Link to={`/projects/${project.id}/package`} className={buttonClasses("secondary")}>
                {t("pages.projectOverview.packageAction")}
              </Link>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("pages.projectOverview.validationHeading")}
              </h3>
              <div
                className={`rounded-md border p-3 text-sm ${
                  validation.canExport ? "border-border text-muted" : "border-danger text-danger"
                }`}
              >
                {validation.issues.length === 0
                  ? t("pages.projectOverview.validationNoIssues")
                  : t("pages.projectOverview.validationIssueCount", {
                      count: validation.issues.length,
                    })}
              </div>
              {validation.issues.length > 0 && (
                <Link
                  to={`/projects/${project.id}/wizard/recommendations`}
                  className={`w-fit ${actionLinkClasses("primary", "sm")}`}
                >
                  {t("pages.projectOverview.reviewValidationAction")}
                </Link>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("pages.projectOverview.actionsHeading")}
              </h3>
              <Button variant="secondary" onClick={() => void handleClone()}>
                {t("pages.projectOverview.cloneAction")}
              </Button>
              {project.status === "archived" ? (
                <Button variant="secondary" onClick={() => setPendingAction("unarchive")}>
                  {t("pages.projectOverview.unarchiveAction")}
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setPendingAction("archive")}>
                  {t("pages.projectOverview.archiveAction")}
                </Button>
              )}
              <Button variant="danger" onClick={() => setPendingAction("trash")}>
                {t("pages.projectOverview.trashAction")}
              </Button>
            </div>
          </SectionCard>
        </InspectorPanel>
      </WorkspaceGrid>

      <ConfirmDialog
        open={pendingAction === "archive"}
        title={t("pages.projects.archiveConfirmTitle", { name: project.meta.name })}
        body={t("pages.projects.archiveConfirmBody")}
        confirmLabel={t("pages.projectOverview.archiveAction")}
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmDialog
        open={pendingAction === "unarchive"}
        title={t("pages.projects.unarchiveConfirmTitle", { name: project.meta.name })}
        body={t("pages.projects.unarchiveConfirmBody")}
        confirmLabel={t("pages.projectOverview.unarchiveAction")}
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmDialog
        open={pendingAction === "trash"}
        title={t("pages.projects.trashConfirmTitle", { name: project.meta.name })}
        body={t("pages.projects.trashConfirmBody")}
        confirmLabel={t("pages.projectOverview.trashAction")}
        destructive
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
