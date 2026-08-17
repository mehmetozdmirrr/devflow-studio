import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import {
  selectVisibleProjects,
  useProjectsStore,
  type ImportConflictResolution,
  type ImportPreview,
  type ProjectSortBy,
  type ProjectStatusFilter,
} from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { UndoToast } from "../components/UndoToast";
import { PageHeader } from "../components/layout/PageHeader";
import {
  PROJECT_STATUS_LABEL_KEYS,
  PROJECT_STATUS_TONES,
} from "../components/layout/projectStatusBadge";
import { Badge } from "../components/ui/Badge";
import { Button, actionLinkClasses, buttonClasses } from "../components/ui/Button";

type PendingAction = { type: "archive" | "unarchive" | "trash"; id: string; name: string } | null;

const UNDO_TIMEOUT_MS = 8000;

export function ProjectsPage() {
  const { t } = useTranslation();
  const hydrated = useProjectsStore((state) => state.hydrated);
  const loadError = useProjectsStore((state) => state.loadError);
  const hydrate = useProjectsStore((state) => state.hydrate);
  const visibleProjects = useProjectsStore(useShallow(selectVisibleProjects));
  const searchQuery = useProjectsStore((state) => state.searchQuery);
  const statusFilter = useProjectsStore((state) => state.statusFilter);
  const sortBy = useProjectsStore((state) => state.sortBy);
  const setSearchQuery = useProjectsStore((state) => state.setSearchQuery);
  const setStatusFilter = useProjectsStore((state) => state.setStatusFilter);
  const setSortBy = useProjectsStore((state) => state.setSortBy);
  const cloneProject = useProjectsStore((state) => state.cloneProject);
  const archiveProject = useProjectsStore((state) => state.archiveProject);
  const unarchiveProject = useProjectsStore((state) => state.unarchiveProject);
  const trashProject = useProjectsStore((state) => state.trashProject);
  const trashUndo = useProjectsStore((state) => state.trashUndo);
  const undoTrash = useProjectsStore((state) => state.undoTrash);
  const dismissTrashUndo = useProjectsStore((state) => state.dismissTrashUndo);
  const exportBackup = useProjectsStore((state) => state.exportBackup);
  const previewImport = useProjectsStore((state) => state.previewImport);
  const commitImport = useProjectsStore((state) => state.commitImport);

  const projectView = useSettingsStore((state) => state.settings.projectView);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<"file" | "shape" | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResolutions, setImportResolutions] = useState<
    Record<string, ImportConflictResolution>
  >({});
  const [applyImportedSettings, setApplyImportedSettings] = useState(false);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!trashUndo) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => dismissTrashUndo(), UNDO_TIMEOUT_MS);
  }, [trashUndo, dismissTrashUndo]);

  if (!hydrated) return <LoadingState />;
  if (loadError) {
    return <ErrorState body={t("pages.projects.errorBody")} onRetry={() => void hydrate()} />;
  }

  async function handleConfirmAction(): Promise<void> {
    if (!pendingAction) return;
    if (pendingAction.type === "archive") await archiveProject(pendingAction.id);
    if (pendingAction.type === "unarchive") await unarchiveProject(pendingAction.id);
    if (pendingAction.type === "trash") await trashProject(pendingAction.id);
    setPendingAction(null);
  }

  function handleClearFilters(): void {
    setSearchQuery("");
    setStatusFilter("all");
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      setImportError("file");
      return;
    }
    const result = previewImport(parsed);
    if (!result.ok) {
      setImportError("shape");
      return;
    }
    setImportError(null);
    setImportPreview(result.preview);
    const defaults: Record<string, ImportConflictResolution> = {};
    for (const conflict of result.preview.diff.conflicts) {
      defaults[conflict.id] = "existing";
    }
    setImportResolutions(defaults);
    setApplyImportedSettings(false);
  }

  async function handleConfirmImport(): Promise<void> {
    if (!importPreview) return;
    await commitImport(importPreview, importResolutions, applyImportedSettings);
    setImportPreview(null);
  }

  const hasActiveFilters = searchQuery.trim().length > 0 || statusFilter !== "all";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("pages.projects.title")}
        actions={
          <>
            <Link to="/projects/new" className={buttonClasses("primary", "md")}>
              {t("pages.projects.createAction")}
            </Link>
            <Button variant="secondary" onClick={() => void exportBackup()}>
              {t("pages.projects.exportAction")}
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              {t("pages.projects.importAction")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              aria-label={t("pages.projects.importFileLabel")}
              onChange={(event) => void handleFileSelected(event)}
            />
          </>
        }
      />

      {importError === "file" && <ErrorState body={t("pages.projects.importInvalidFile")} />}
      {importError === "shape" && <ErrorState body={t("pages.projects.importInvalidShape")} />}

      {visibleProjects.length === 0 && !hasActiveFilters && (
        <EmptyState
          title={t("pages.projects.emptyTitle")}
          body={t("pages.projects.emptyBody")}
          action={
            <Link to="/projects/new" className={buttonClasses("primary", "md")}>
              {t("pages.projects.createAction")}
            </Link>
          }
        />
      )}

      {(visibleProjects.length > 0 || hasActiveFilters) && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3">
          <label className="flex flex-col gap-1 text-sm text-text" htmlFor="projects-search-input">
            {t("pages.projects.searchLabel")}
            <input
              id="projects-search-input"
              type="search"
              value={searchQuery}
              placeholder={t("pages.projects.searchPlaceholder")}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-52 rounded-md border border-border bg-background px-3 py-1.5 text-text"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text" htmlFor="projects-status-filter">
            {t("pages.projects.statusFilterLabel")}
            <select
              id="projects-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ProjectStatusFilter)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-text"
            >
              <option value="all">{t("pages.projects.statusFilterAll")}</option>
              <option value="draft">{t("pages.projects.statusFilterDraft")}</option>
              <option value="archived">{t("pages.projects.statusFilterArchived")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-text" htmlFor="projects-sort-select">
            {t("pages.projects.sortLabel")}
            <select
              id="projects-sort-select"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as ProjectSortBy)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-text"
            >
              <option value="updatedAt">{t("pages.projects.sortUpdatedAt")}</option>
              <option value="name">{t("pages.projects.sortName")}</option>
            </select>
          </label>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className={`mb-1.5 ${actionLinkClasses("primary", "sm")}`}
            >
              {t("pages.projects.clearFilters")}
            </button>
          )}
        </div>
      )}

      {visibleProjects.length === 0 && hasActiveFilters && (
        <EmptyState
          title={t("pages.projects.noResultsTitle")}
          body={t("pages.projects.noResultsBody")}
          action={
            <Button variant="secondary" onClick={handleClearFilters}>
              {t("pages.projects.clearFilters")}
            </Button>
          }
        />
      )}

      {visibleProjects.length > 0 && (
        <ul
          className={
            projectView === "table"
              ? "flex flex-col divide-y divide-border"
              : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          }
        >
          {visibleProjects.map((project) => (
            <li
              key={project.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  to={`/projects/${project.id}`}
                  className="font-medium text-text hover:underline"
                >
                  {project.meta.name}
                </Link>
                <Badge tone={PROJECT_STATUS_TONES[project.status]}>
                  {t(PROJECT_STATUS_LABEL_KEYS[project.status])}
                </Badge>
              </div>
              <p className="line-clamp-2 text-sm text-muted">{project.brief.idea}</p>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link
                  to={`/projects/${project.id}`}
                  className={`font-semibold ${actionLinkClasses("primary")}`}
                >
                  {t("pages.projects.openAction")}
                </Link>
                <button
                  type="button"
                  onClick={() => void cloneProject(project.id)}
                  className={actionLinkClasses("neutral")}
                >
                  {t("pages.projects.cloneAction")}
                </button>
                {project.status === "archived" ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPendingAction({
                        type: "unarchive",
                        id: project.id,
                        name: project.meta.name,
                      })
                    }
                    className={actionLinkClasses("neutral")}
                  >
                    {t("pages.projects.unarchiveAction")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setPendingAction({ type: "archive", id: project.id, name: project.meta.name })
                    }
                    className={actionLinkClasses("neutral")}
                  >
                    {t("pages.projects.archiveAction")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setPendingAction({ type: "trash", id: project.id, name: project.meta.name })
                  }
                  className={`ml-auto ${actionLinkClasses("danger")}`}
                >
                  {t("pages.projects.trashAction")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingAction?.type === "archive"}
        title={t("pages.projects.archiveConfirmTitle", { name: pendingAction?.name ?? "" })}
        body={t("pages.projects.archiveConfirmBody")}
        confirmLabel={t("pages.projects.archiveAction")}
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmDialog
        open={pendingAction?.type === "unarchive"}
        title={t("pages.projects.unarchiveConfirmTitle", { name: pendingAction?.name ?? "" })}
        body={t("pages.projects.unarchiveConfirmBody")}
        confirmLabel={t("pages.projects.unarchiveAction")}
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmDialog
        open={pendingAction?.type === "trash"}
        title={t("pages.projects.trashConfirmTitle", { name: pendingAction?.name ?? "" })}
        body={t("pages.projects.trashConfirmBody")}
        confirmLabel={t("pages.projects.trashAction")}
        destructive
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={importPreview !== null}
        title={t("pages.projects.importDialogTitle")}
        confirmLabel={t("pages.projects.importConfirm")}
        cancelLabel={t("pages.projects.importCancel")}
        onConfirm={() => void handleConfirmImport()}
        onCancel={() => setImportPreview(null)}
        body={
          importPreview && (
            <div className="flex flex-col gap-3 text-sm text-text">
              <p>
                {t("pages.projects.importSummaryNew", {
                  count: importPreview.diff.newProjects.length,
                })}
              </p>
              {importPreview.diff.conflicts.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p>
                    {t("pages.projects.importSummaryConflicts", {
                      count: importPreview.diff.conflicts.length,
                    })}
                  </p>
                  {importPreview.diff.conflicts.map((conflict) => (
                    <fieldset key={conflict.id} className="rounded-md border border-border p-2">
                      <legend className="px-1 text-xs text-muted">
                        {conflict.existing.meta.name}
                      </legend>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          name={`conflict-${conflict.id}`}
                          checked={importResolutions[conflict.id] !== "imported"}
                          onChange={() =>
                            setImportResolutions((prev) => ({ ...prev, [conflict.id]: "existing" }))
                          }
                        />
                        {t("pages.projects.importConflictKeepExisting")}
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          name={`conflict-${conflict.id}`}
                          checked={importResolutions[conflict.id] === "imported"}
                          onChange={() =>
                            setImportResolutions((prev) => ({ ...prev, [conflict.id]: "imported" }))
                          }
                        />
                        {t("pages.projects.importConflictUseImported")}
                      </label>
                    </fieldset>
                  ))}
                </div>
              )}
              {importPreview.payload.settings && (
                <div className="flex flex-col gap-1 rounded-md border border-border p-2">
                  <p>{t("pages.projects.importSettingsFound")}</p>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={applyImportedSettings}
                      onChange={(event) => setApplyImportedSettings(event.target.checked)}
                    />
                    {t("pages.projects.importSettingsApply")}
                  </label>
                  {!applyImportedSettings && (
                    <span className="text-xs text-muted">
                      {t("pages.projects.importSettingsNotApplied")}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        }
      />

      {trashUndo && (
        <UndoToast
          message={t("pages.projects.trashUndoMessage", { name: trashUndo.meta.name })}
          actionLabel={t("pages.projects.undo")}
          onAction={() => void undoTrash()}
        />
      )}
    </div>
  );
}
