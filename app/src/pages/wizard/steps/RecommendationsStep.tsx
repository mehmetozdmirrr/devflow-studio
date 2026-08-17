import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type { CatalogItem, CatalogItemKind } from "@contracts/catalog";
import type { Locale } from "@contracts/common";
import type { Project } from "@contracts/project";
import type { RecommendationResult } from "@contracts/recommendation";

import { selectAllCatalogItems, useCatalogStore } from "../../../application/catalogStore";
import {
  computeRecommendations,
  computeValidation,
  useRecommendationsStore,
} from "../../../application/recommendationsStore";
import { SYSTEM_RECOMMENDATION_RULES } from "../../../catalog/recommendationRules";
import { CATALOG_ITEM_KINDS } from "../../../domain/catalog";
import { Button } from "../../../components/ui/Button";

interface RecommendationsStepProps {
  project: Project;
}

function reasonLine(contribution: RecommendationResult["contributions"][number]): string {
  const sign = contribution.delta > 0 ? "+" : "";
  return `${contribution.reason} (${sign}${contribution.delta})`;
}

export function RecommendationsStep({ project }: RecommendationsStepProps) {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language === "tr" ? "tr" : "en") as Locale;

  const catalogHydrated = useCatalogStore((state) => state.hydrated);
  const hydrateCatalog = useCatalogStore((state) => state.hydrate);
  const catalogItems = useCatalogStore(useShallow(selectAllCatalogItems));
  const acceptItem = useRecommendationsStore((state) => state.acceptItem);
  const removeItem = useRecommendationsStore((state) => state.removeItem);
  const addCustomItem = useRecommendationsStore((state) => state.addCustomItem);
  const acknowledgeIssue = useRecommendationsStore((state) => state.acknowledgeIssue);

  const [manualQuery, setManualQuery] = useState("");
  const [customName, setCustomName] = useState("");
  const [customKind, setCustomKind] = useState<CatalogItemKind>("library");
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!catalogHydrated) void hydrateCatalog();
  }, [catalogHydrated, hydrateCatalog]);

  const results = useMemo(
    () =>
      catalogHydrated
        ? computeRecommendations(project, catalogItems, SYSTEM_RECOMMENDATION_RULES, locale)
        : [],
    [catalogHydrated, project, catalogItems, locale],
  );
  const validation = useMemo(
    () => (catalogHydrated ? computeValidation(project, catalogItems) : project.validation),
    [catalogHydrated, project, catalogItems],
  );

  const itemsById = useMemo(
    () => new Map(catalogItems.map((item) => [item.id, item])),
    [catalogItems],
  );
  const selectionByItemId = useMemo(
    () => new Map(project.selections.filter((s) => s.itemId).map((s) => [s.itemId as string, s])),
    [project.selections],
  );

  const mode = project.configuration.selectionMode;
  const requiredResults = results.filter((r) => r.classification === "required");
  const recommendedResults = results.filter((r) => r.classification === "recommended");
  const alternativeResults = results
    .filter((r) => r.classification === "alternative" && r.score > 0)
    .slice(0, 10);

  const suggestedResults = [...requiredResults, ...recommendedResults];
  const pendingSuggestedCount = suggestedResults.filter((r) => {
    const selection = selectionByItemId.get(r.itemId);
    return !selection || selection.decision !== "accepted";
  }).length;

  async function handleAcceptAllSuggested(): Promise<void> {
    for (const result of suggestedResults) {
      const selection = selectionByItemId.get(result.itemId);
      if (selection?.decision === "accepted") continue;
      const item = itemsById.get(result.itemId);
      if (item) await acceptItem(project.id, item, "deterministic");
    }
  }

  function renderResultRow(result: RecommendationResult, source: "deterministic" | "manual") {
    const item = itemsById.get(result.itemId);
    if (!item) return null;
    const selection = selectionByItemId.get(result.itemId);
    const isAccepted = selection?.decision === "accepted";
    const isRemoved = selection?.decision === "removed";
    const topReasons = [...result.contributions]
      .filter((c) => c.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);

    return (
      <li
        key={result.itemId}
        data-testid={`recommendation-item-${result.itemId}`}
        className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-text">
            {item.name}{" "}
            <span className="text-xs text-muted">· {t(`catalog.kind.${item.kind}`)}</span>
          </span>
          <span className="text-xs text-muted">
            {t("wizard.recommendations.scoreLabel", { score: result.score })}
          </span>
        </div>
        {topReasons.length > 0 && (
          <ul className="list-disc pl-4 text-xs text-muted">
            {topReasons.map((contribution) => (
              <li key={contribution.reasonCode}>{reasonLine(contribution)}</li>
            ))}
          </ul>
        )}
        {result.missingDependencyIds.length > 0 && (
          <p className="text-xs text-danger">
            {t("wizard.recommendations.missingDependency", {
              ids: result.missingDependencyIds.join(", "),
            })}
          </p>
        )}
        <div className="flex gap-3">
          {isAccepted ? (
            <button
              type="button"
              onClick={() => void removeItem(project.id, item)}
              className="text-xs font-medium text-danger hover:underline"
            >
              {t("wizard.recommendations.removeAction")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void acceptItem(project.id, item, source)}
              className="text-xs font-medium text-primary-text hover:underline"
            >
              {isRemoved
                ? t("wizard.recommendations.restoreAction")
                : t("wizard.recommendations.acceptAction")}
            </button>
          )}
        </div>
      </li>
    );
  }

  const manualResults: CatalogItem[] = manualQuery.trim()
    ? catalogItems
        .filter((item) => item.name.toLowerCase().includes(manualQuery.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <p className="text-sm text-muted">{t(`wizard.recommendations.modeNote.${mode}`)}</p>

      {mode === "automatic" && pendingSuggestedCount > 0 && (
        <div className="flex items-center justify-between rounded-md border border-border bg-surface p-3">
          <p className="text-sm text-text">
            {t("wizard.recommendations.pendingSuggestedCount", { count: pendingSuggestedCount })}
          </p>
          <button
            type="button"
            onClick={() => void handleAcceptAllSuggested()}
            className="rounded-md bg-primary-interactive px-3 py-1.5 text-sm font-medium text-on-primary hover:opacity-90"
          >
            {t("wizard.recommendations.acceptAllAction")}
          </button>
        </div>
      )}

      {requiredResults.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-text">
            {t("wizard.recommendations.requiredHeading")}
          </h2>
          <ul className="flex flex-col gap-2">
            {requiredResults.map((r) => renderResultRow(r, "deterministic"))}
          </ul>
        </section>
      )}

      {mode !== "manual" && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text">
              {t("wizard.recommendations.recommendedHeading")}
            </h2>
            {recommendedResults.length === 0 ? (
              <p className="text-sm text-muted">{t("wizard.recommendations.noneYet")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recommendedResults.map((r) => renderResultRow(r, "deterministic"))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text">
              {t("wizard.recommendations.alternativesHeading")}
            </h2>
            {alternativeResults.length === 0 ? (
              <p className="text-sm text-muted">{t("wizard.recommendations.noneYet")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {alternativeResults.map((r) => renderResultRow(r, "manual"))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text">
          {t("wizard.recommendations.manualAddHeading")}
        </h2>
        <label
          className="flex flex-col gap-1 text-sm text-text"
          htmlFor="wizard-recommendations-search"
        >
          {t("wizard.recommendations.manualSearchLabel")}
          <input
            id="wizard-recommendations-search"
            type="search"
            value={manualQuery}
            onChange={(event) => setManualQuery(event.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-text"
          />
        </label>
        {manualResults.length > 0 && (
          <ul className="flex flex-col gap-2">
            {manualResults.map((item) => (
              <li
                key={item.id}
                data-testid={`manual-search-item-${item.id}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
              >
                <span>
                  {item.name}{" "}
                  <span className="text-xs text-muted">· {t(`catalog.kind.${item.kind}`)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void acceptItem(project.id, item, "manual")}
                  className="text-xs font-medium text-primary-text hover:underline"
                >
                  {t("wizard.recommendations.addAction")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text">
          {t("wizard.recommendations.customAddHeading")}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label
            className="flex flex-col gap-1 text-sm text-text"
            htmlFor="wizard-recommendations-custom-name"
          >
            {t("wizard.recommendations.customNameLabel")}
            <input
              id="wizard-recommendations-custom-name"
              type="text"
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-text"
            />
          </label>
          <label
            className="flex flex-col gap-1 text-sm text-text"
            htmlFor="wizard-recommendations-custom-kind"
          >
            {t("wizard.recommendations.customKindLabel")}
            <select
              id="wizard-recommendations-custom-kind"
              value={customKind}
              onChange={(event) => setCustomKind(event.target.value as CatalogItemKind)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-text"
            >
              {CATALOG_ITEM_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`catalog.kind.${kind}`)}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={customName.trim().length === 0}
            onClick={() => {
              void addCustomItem(project.id, { name: customName, kind: customKind });
              setCustomName("");
            }}
          >
            {t("wizard.recommendations.addCustomAction")}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text">
          {t("wizard.recommendations.validationHeading")}
        </h2>
        <p className="text-sm text-muted">
          {validation.canExport
            ? t("wizard.recommendations.validationOk")
            : t("wizard.recommendations.validationBlocked")}
        </p>
        {validation.issues.length === 0 ? (
          <p className="text-sm text-muted">{t("wizard.recommendations.noIssues")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {validation.issues.map((issue) => (
              <li
                key={issue.id}
                className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text">{issue.message}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      issue.severity === "blocker" || issue.severity === "error"
                        ? "border-danger text-danger"
                        : "border-border text-muted"
                    }`}
                  >
                    {t(`wizard.recommendations.severity.${issue.severity}`)}
                  </span>
                </div>
                {(issue.severity === "info" || issue.severity === "warning") &&
                  (issue.override ? (
                    <p className="text-xs text-muted">
                      {t("wizard.recommendations.acknowledged", { reason: issue.override.reason })}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        placeholder={t("wizard.recommendations.acknowledgeReasonPlaceholder")}
                        value={overrideReasons[issue.id] ?? ""}
                        onChange={(event) =>
                          setOverrideReasons((prev) => ({
                            ...prev,
                            [issue.id]: event.target.value,
                          }))
                        }
                        className="min-w-48 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
                      />
                      <button
                        type="button"
                        disabled={(overrideReasons[issue.id] ?? "").trim().length === 0}
                        onClick={() =>
                          void acknowledgeIssue(
                            project.id,
                            issue.id,
                            overrideReasons[issue.id] ?? "",
                          )
                        }
                        className="text-xs font-medium text-primary-text hover:underline disabled:opacity-60"
                      >
                        {t("wizard.recommendations.acknowledgeAction")}
                      </button>
                    </div>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
