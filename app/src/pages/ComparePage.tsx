import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type { Identifier } from "@contracts/common";

import {
  selectAllCatalogItems,
  selectCompareItems,
  useCatalogStore,
} from "../application/catalogStore";
import { useProjectsStore, selectVisibleProjects } from "../application/projectsStore";
import {
  COMPARISON_CRITERIA,
  MIN_COMPARE_ITEMS,
  getComparisonValue,
  type ComparisonCriterionKey,
} from "../domain/catalog";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button, actionLinkClasses, buttonClasses } from "../components/ui/Button";

const BADGE_CRITERIA = new Set<ComparisonCriterionKey>([
  "kind",
  "difficulty",
  "maturity",
  "origin",
  "verification",
]);

function translatedCriterionValue(
  raw: string,
  criterion: ComparisonCriterionKey,
  t: (key: string) => string,
): string {
  switch (criterion) {
    case "kind":
      return t(`catalog.kind.${raw}`);
    case "difficulty":
      return t(`catalog.difficulty.${raw}`);
    case "maturity":
      return t(`catalog.maturity.${raw}`);
    case "origin":
      return t(`catalog.origin.${raw}`);
    case "verification":
      return t(`catalog.verification.${raw}`);
    default:
      return raw;
  }
}

export function ComparePage() {
  const { t } = useTranslation();

  const hydrated = useCatalogStore((state) => state.hydrated);
  const loadError = useCatalogStore((state) => state.loadError);
  const hydrate = useCatalogStore((state) => state.hydrate);
  const allItems = useCatalogStore(useShallow(selectAllCatalogItems));
  const compareItems = useCatalogStore(useShallow(selectCompareItems));
  const removeFromCompare = useCatalogStore((state) => state.removeFromCompare);
  const replaceInComparison = useCatalogStore((state) => state.replaceInComparison);
  const clearCompare = useCatalogStore((state) => state.clearCompare);
  const addItemToProject = useCatalogStore((state) => state.addItemToProject);

  const projectsHydrated = useProjectsStore((state) => state.hydrated);
  const hydrateProjects = useProjectsStore((state) => state.hydrate);
  const projects = useProjectsStore(useShallow(selectVisibleProjects));

  const [addToProjectItemId, setAddToProjectItemId] = useState<Identifier | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string>("");

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!projectsHydrated) void hydrateProjects();
  }, [projectsHydrated, hydrateProjects]);

  if (!hydrated) return <LoadingState />;
  if (loadError) {
    return <ErrorState body={t("pages.compare.errorBody")} onRetry={() => void hydrate()} />;
  }

  async function handleConfirmAddToProject(): Promise<void> {
    if (!addToProjectItemId || !targetProjectId) return;
    await addItemToProject(addToProjectItemId, targetProjectId);
    setAddToProjectItemId(null);
    setTargetProjectId("");
  }

  function alternativesFor(itemId: Identifier): Identifier[] {
    const item = allItems.find((candidate) => candidate.id === itemId);
    if (!item) return [];
    return item.relations
      .filter((relation) => relation.type === "compatible-with" || relation.type === "replaces")
      .map((relation) => relation.targetId)
      .filter((targetId) => allItems.some((candidate) => candidate.id === targetId));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("pages.compare.title")}
        actions={
          compareItems.length > 0 && (
            <Button variant="secondary" onClick={clearCompare}>
              {t("pages.compare.clearAction")}
            </Button>
          )
        }
      />

      {compareItems.length < MIN_COMPARE_ITEMS && (
        <EmptyState
          title={t("pages.compare.emptyTitle")}
          body={t("pages.compare.emptyBody")}
          action={
            <Link to="/catalog" className={buttonClasses("primary", "md")}>
              {t("pages.compare.browseCatalogAction")}
            </Link>
          }
        />
      )}

      {compareItems.length >= MIN_COMPARE_ITEMS && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface">
                <th className="w-40 border-b border-border p-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  {t("pages.compare.criterionColumn")}
                </th>
                {compareItems.map((item) => (
                  <th key={item.id} className="border-b border-border p-3 text-left text-text">
                    <div className="flex flex-col gap-2">
                      <span className="font-semibold">{item.name}</span>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-normal">
                        <button
                          type="button"
                          onClick={() => removeFromCompare(item.id)}
                          className={actionLinkClasses("danger", "sm")}
                        >
                          {t("pages.compare.removeAction")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddToProjectItemId(item.id)}
                          className={actionLinkClasses("primary", "sm")}
                        >
                          {t("pages.catalog.addToProjectAction")}
                        </button>
                      </div>
                      {alternativesFor(item.id).length > 0 && (
                        <label className="flex flex-col gap-1 text-xs font-normal text-muted">
                          {t("pages.compare.selectAlternativeLabel")}
                          <select
                            value=""
                            onChange={(event) => {
                              if (event.target.value)
                                replaceInComparison(item.id, event.target.value);
                            }}
                            className="rounded-md border border-border bg-surface px-2 py-1 text-text"
                          >
                            <option value="">
                              {t("pages.compare.selectAlternativePlaceholder")}
                            </option>
                            {alternativesFor(item.id).map((altId) => (
                              <option key={altId} value={altId}>
                                {allItems.find((candidate) => candidate.id === altId)?.name ??
                                  altId}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_CRITERIA.map((criterion, rowIndex) => (
                <tr key={criterion} className={rowIndex % 2 === 1 ? "bg-surface/40" : undefined}>
                  <th
                    scope="row"
                    className="border-b border-border p-3 text-left font-medium text-text"
                  >
                    {t(`pages.compare.criterion.${criterion}`)}
                  </th>
                  {compareItems.map((item) => {
                    const raw = getComparisonValue(item, criterion);
                    if (raw === undefined) {
                      return (
                        <td key={item.id} className="border-b border-border p-3 text-muted italic">
                          {t("pages.catalog.detail.notAvailable")}
                        </td>
                      );
                    }
                    const value = translatedCriterionValue(raw, criterion, t);
                    return (
                      <td key={item.id} className="border-b border-border p-3 text-text">
                        {BADGE_CRITERIA.has(criterion) ? (
                          <Badge tone={raw === "deprecated" ? "danger" : "neutral"}>{value}</Badge>
                        ) : (
                          value
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={addToProjectItemId !== null}
        title={t("pages.catalog.addToProjectDialogTitle")}
        confirmLabel={t("pages.catalog.addToProjectAction")}
        onConfirm={() => void handleConfirmAddToProject()}
        onCancel={() => {
          setAddToProjectItemId(null);
          setTargetProjectId("");
        }}
        body={
          projects.length === 0 ? (
            <p>
              {t("pages.catalog.addToProjectNoProjects")}{" "}
              <Link to="/projects/new" className="underline">
                {t("pages.projects.createAction")}
              </Link>
            </p>
          ) : (
            <label className="flex flex-col gap-1 text-sm" htmlFor="compare-add-to-project-select">
              {t("pages.catalog.addToProjectSelectLabel")}
              <select
                id="compare-add-to-project-select"
                value={targetProjectId}
                onChange={(event) => setTargetProjectId(event.target.value)}
                className="rounded-md border border-border bg-surface px-3 py-2 text-text"
              >
                <option value="">{t("common.emptyTitle")}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.meta.name}
                  </option>
                ))}
              </select>
            </label>
          )
        }
      />
    </div>
  );
}
