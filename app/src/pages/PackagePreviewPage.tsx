import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { ValidationSeverity } from "@contracts/validation";

import { useProjectsStore } from "../application/projectsStore";
import { useCatalogStore } from "../application/catalogStore";
import { usePackageStore } from "../application/packageStore";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
import { SectionCard } from "../components/ui/SectionCard";
import { Badge } from "../components/ui/Badge";
import { Button, actionLinkClasses } from "../components/ui/Button";

const SEVERITY_ORDER: ValidationSeverity[] = ["blocker", "error", "warning", "info"];

export function PackagePreviewPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();

  const hydrated = useProjectsStore((state) => state.hydrated);
  const loadError = useProjectsStore((state) => state.loadError);
  const hydrate = useProjectsStore((state) => state.hydrate);
  const project = useProjectsStore((state) =>
    state.projects.find((candidate) => candidate.id === projectId),
  );

  const catalogHydrated = useCatalogStore((state) => state.hydrated);
  const hydrateCatalog = useCatalogStore((state) => state.hydrate);

  const generate = usePackageStore((state) => state.generate);
  const setExcluded = usePackageStore((state) => state.setExcluded);
  const setOverride = usePackageStore((state) => state.setOverride);
  const downloadZip = usePackageStore((state) => state.downloadZip);
  const downloadManifestJson = usePackageStore((state) => state.downloadManifestJson);
  const downloadMarkdownBundle = usePackageStore((state) => state.downloadMarkdownBundle);
  const downloadFile = usePackageStore((state) => state.downloadFile);
  const result = usePackageStore((state) =>
    projectId ? state.resultsByProjectId[projectId] : undefined,
  );

  const [generating, setGenerating] = useState(false);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!catalogHydrated) void hydrateCatalog();
  }, [catalogHydrated, hydrateCatalog]);

  if (!hydrated || !catalogHydrated) {
    return <LoadingState />;
  }

  if (loadError) {
    return <ErrorState body={t("pages.projects.errorBody")} onRetry={() => void hydrate()} />;
  }

  if (!project || !projectId) {
    return (
      <EmptyState
        title={t("pages.package.title")}
        body={t("pages.package.notFoundBody")}
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

  async function handleGenerate(): Promise<void> {
    setGenerating(true);
    try {
      await generate(projectId as string);
    } finally {
      setGenerating(false);
    }
  }

  function startEdit(path: string, content: string): void {
    setEditingPath(path);
    setEditDraft(content);
  }

  async function saveEdit(): Promise<void> {
    if (!editingPath) return;
    await setOverride(projectId as string, editingPath, editDraft);
    setEditingPath(null);
  }

  async function resetOverride(path: string): Promise<void> {
    await setOverride(projectId as string, path, undefined);
  }

  const excludedPaths = new Set(project.packageSettings.excludedOptionalPaths);
  const blockerCount = result?.issues.filter((issue) => issue.severity === "blocker").length ?? 0;
  const sortedIssues = result
    ? [...result.issues].sort(
        (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
      )
    : [];

  // Presentation-only grouping derived from each file's real generated path — never hardcoded,
  // so it stays correct if the generator's output layout changes. Files without a "/" (e.g.
  // CLAUDE.md) fall into a single root-level group; group order follows first appearance.
  type PackageFile = NonNullable<typeof result>["files"][number];
  const fileGroups: Array<{ label: string; files: PackageFile[] }> = [];
  if (result) {
    const groupIndexByLabel = new Map<string, number>();
    for (const file of result.files) {
      const separatorIndex = file.path.indexOf("/");
      const label =
        separatorIndex === -1 ? t("pages.package.rootGroup") : file.path.slice(0, separatorIndex);
      let index = groupIndexByLabel.get(label);
      if (index === undefined) {
        index = fileGroups.length;
        groupIndexByLabel.set(label, index);
        fileGroups.push({ label, files: [] });
      }
      fileGroups[index].files.push(file);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: `/projects/${project.id}`, label: t("pages.package.backToProject") }}
        title={t("pages.package.title")}
        actions={
          <Button variant="primary" onClick={() => void handleGenerate()} disabled={generating}>
            {generating
              ? t("pages.package.generatingNotice")
              : result
                ? t("pages.package.regenerateAction")
                : t("pages.package.generateAction")}
          </Button>
        }
      />

      {!result ? (
        <EmptyState body={t("pages.package.emptyBody")} />
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => void downloadZip(projectId as string)}
              disabled={!result.canExport}
            >
              {t("pages.package.downloadZipAction")}
            </Button>
            <Button variant="secondary" onClick={() => downloadManifestJson(projectId as string)}>
              {t("pages.package.downloadManifestAction")}
            </Button>
            <Button variant="secondary" onClick={() => downloadMarkdownBundle(projectId as string)}>
              {t("pages.package.downloadMarkdownAction")}
            </Button>
          </div>

          {sortedIssues.length === 0 ? (
            <p className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
              {t("pages.package.readySummary", { count: result.files.length })}
            </p>
          ) : (
            <SectionCard title={t("pages.package.issuesHeading")}>
              <ul className="flex flex-col gap-2">
                {sortedIssues.map((issue) => (
                  <li
                    key={issue.id}
                    className={`rounded-md border p-3 text-sm ${
                      issue.severity === "blocker" || issue.severity === "error"
                        ? "border-danger text-danger"
                        : "border-border text-muted"
                    }`}
                  >
                    <span className="font-medium">
                      {t(`pages.package.severity.${issue.severity}`)}
                    </span>{" "}
                    {issue.message}
                  </li>
                ))}
              </ul>
              {blockerCount > 0 && (
                <p className="text-sm font-medium text-danger">
                  {t("pages.package.blockerNotice")}
                </p>
              )}
            </SectionCard>
          )}

          <SectionCard title={t("pages.package.treeHeading")}>
            {fileGroups.map((group) => (
              <div key={group.label} className="flex flex-col gap-2">
                {fileGroups.length > 1 && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {group.label}
                  </p>
                )}
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-background">
                  {group.files.map((file) => {
                    const excluded = file.excludable && excludedPaths.has(file.path);
                    const hasOverride =
                      project.packageSettings.textOverrides[file.path] !== undefined;
                    return (
                      <li key={file.path} className="flex flex-col gap-2 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-text">{file.path}</span>
                          <div className="flex flex-wrap gap-1">
                            {file.required && <Badge>{t("pages.package.requiredBadge")}</Badge>}
                            {file.editable && <Badge>{t("pages.package.editableBadge")}</Badge>}
                            {file.excludable && (
                              <Badge tone={excluded ? "warning" : "neutral"}>
                                {excluded
                                  ? t("pages.package.excludedBadge")
                                  : t("pages.package.excludableBadge")}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {file.excludable && (
                            <button
                              type="button"
                              onClick={() =>
                                void setExcluded(projectId as string, file.path, !excluded)
                              }
                              className={actionLinkClasses("primary", "sm")}
                            >
                              {excluded
                                ? t("pages.package.includeAction")
                                : t("pages.package.excludeAction")}
                            </button>
                          )}
                          {file.editable && editingPath !== file.path && (
                            <button
                              type="button"
                              onClick={() => startEdit(file.path, file.content)}
                              className={actionLinkClasses("primary", "sm")}
                            >
                              {t("pages.package.editOverrideAction")}
                            </button>
                          )}
                          {file.editable && hasOverride && (
                            <button
                              type="button"
                              onClick={() => void resetOverride(file.path)}
                              className={actionLinkClasses("primary", "sm")}
                            >
                              {t("pages.package.resetOverrideAction")}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => downloadFile(projectId as string, file.path)}
                            className={actionLinkClasses("primary", "sm")}
                          >
                            {t("pages.package.downloadFileAction")}
                          </button>
                        </div>
                        <details className="text-xs text-muted">
                          <summary className="cursor-pointer select-none text-primary-text">
                            {t("pages.package.detailsToggle")}
                          </summary>
                          <p className="mt-1">
                            {t("pages.package.sourceLabel")}: {file.source} ·{" "}
                            {t("pages.package.hashLabel")}: {file.contentHash.slice(0, 12)}
                          </p>
                          <p>
                            {t("pages.package.inclusionReasonLabel")}: {file.inclusionReason}
                          </p>
                        </details>
                        {editingPath === file.path && (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={editDraft}
                              onChange={(event) => setEditDraft(event.target.value)}
                              className="min-h-32 rounded-md border border-border bg-surface p-2 font-mono text-xs text-text"
                            />
                            <div className="flex gap-2">
                              <Button variant="primary" size="sm" onClick={() => void saveEdit()}>
                                {t("pages.package.saveOverrideAction")}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingPath(null)}
                              >
                                {t("pages.package.cancelOverrideAction")}
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </SectionCard>
        </>
      )}
    </div>
  );
}
