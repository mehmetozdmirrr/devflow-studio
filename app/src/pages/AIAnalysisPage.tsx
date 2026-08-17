import { useEffect } from "react";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { useProjectsStore } from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import { selectAllCatalogItems, useCatalogStore } from "../application/catalogStore";
import { type AIReviewCategory, useAIStore } from "../application/aiStore";
import { HttpAIAnalysisClient } from "../adapters/aiAnalysisClient";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";
import { SectionCard } from "../components/ui/SectionCard";
import { Badge } from "../components/ui/Badge";
import { Button, actionLinkClasses } from "../components/ui/Button";

export function AIAnalysisPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();

  const hydrated = useProjectsStore((state) => state.hydrated);
  const loadError = useProjectsStore((state) => state.loadError);
  const hydrate = useProjectsStore((state) => state.hydrate);
  const project = useProjectsStore((state) =>
    state.projects.find((candidate) => candidate.id === projectId),
  );

  const settingsHydrated = useSettingsStore((state) => state.hydrated);
  const aiEnabled = useSettingsStore((state) => state.settings.ai.enabled);

  const catalogHydrated = useCatalogStore((state) => state.hydrated);
  const hydrateCatalog = useCatalogStore((state) => state.hydrate);
  const catalogItems = useCatalogStore(useShallow(selectAllCatalogItems));

  const status = useAIStore((state) => state.status);
  const lastError = useAIStore((state) => state.lastError);
  const buildPreview = useAIStore((state) => state.buildPreview);
  const cancel = useAIStore((state) => state.cancel);
  const confirmAndSend = useAIStore((state) => state.confirmAndSend);
  const dismissError = useAIStore((state) => state.dismissError);
  const reviewed = useAIStore((state) => (projectId ? state.reviewed[projectId] : undefined));
  const reviewClarification = useAIStore((state) => state.reviewClarification);
  const reviewRisk = useAIStore((state) => state.reviewRisk);
  const reviewTestNeed = useAIStore((state) => state.reviewTestNeed);
  const reviewDocumentNeed = useAIStore((state) => state.reviewDocumentNeed);
  const acceptRequirementProposal = useAIStore((state) => state.acceptRequirementProposal);
  const rejectRequirementProposal = useAIStore((state) => state.rejectRequirementProposal);
  const acceptCatalogRecommendation = useAIStore((state) => state.acceptCatalogRecommendation);
  const rejectCatalogRecommendation = useAIStore((state) => state.rejectCatalogRecommendation);
  const acceptCustomProposal = useAIStore((state) => state.acceptCustomProposal);
  const rejectCustomProposal = useAIStore((state) => state.rejectCustomProposal);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!catalogHydrated) void hydrateCatalog();
  }, [catalogHydrated, hydrateCatalog]);

  if (!hydrated || !settingsHydrated || !catalogHydrated) {
    return <LoadingState />;
  }

  if (loadError) {
    return <ErrorState body={t("pages.projects.errorBody")} onRetry={() => void hydrate()} />;
  }

  if (!project || !projectId) {
    return (
      <EmptyState
        title={t("pages.aiAnalysis.title")}
        body={t("pages.aiAnalysis.notFoundBody")}
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

  const backTo = { to: `/projects/${project.id}`, label: t("pages.aiAnalysis.backToProject") };

  if (!aiEnabled) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={backTo} title={t("pages.aiAnalysis.title")} />
        <EmptyState
          title={t("pages.aiAnalysis.disabledTitle")}
          body={t("pages.aiAnalysis.disabledBody")}
          action={
            <Link to="/settings" className={actionLinkClasses("primary")}>
              {t("pages.aiAnalysis.goToSettingsAction")}
            </Link>
          }
        />
      </div>
    );
  }

  const result = project.latestAIAnalysis;

  function catalogItemName(itemId: string): string {
    return catalogItems.find((item) => item.id === itemId)?.name ?? itemId;
  }

  function decisionFor(
    category: AIReviewCategory,
    key: string,
  ): "accepted" | "rejected" | undefined {
    return reviewed?.[category]?.[key];
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={backTo} title={t("pages.aiAnalysis.title")} />

      {status === "error" && lastError && (
        <SectionCard className="border-danger/40">
          <p className="text-sm font-medium text-danger">{lastError.error.message}</p>
          <p className="text-sm text-muted">{lastError.error.fallback}</p>
          <div className="flex gap-3">
            <Button variant="primary" size="sm" onClick={() => buildPreview(projectId)}>
              {t("pages.aiAnalysis.retryAction")}
            </Button>
            <Button variant="secondary" size="sm" onClick={dismissError}>
              {t("pages.aiAnalysis.dismissErrorAction")}
            </Button>
          </div>
        </SectionCard>
      )}

      {status === "idle" && !result && (
        <SectionCard>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("pages.aiAnalysis.whatIsSharedHeading")}
            </p>
            <p className="text-sm text-text">{t("pages.aiAnalysis.consentNotice")}</p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("pages.aiAnalysis.whatHappensHeading")}
            </p>
            <ul className="flex flex-col gap-1 text-sm text-muted">
              <li>{t("pages.aiAnalysis.whatHappensItem1")}</li>
              <li>{t("pages.aiAnalysis.whatHappensItem2")}</li>
              <li>{t("pages.aiAnalysis.whatHappensItem3")}</li>
            </ul>
          </div>

          <Button variant="primary" className="w-fit" onClick={() => buildPreview(projectId)}>
            {t("pages.aiAnalysis.startAction")}
          </Button>

          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("pages.aiAnalysis.whatYoullReceiveHeading")}
            </p>
            <ul className="flex flex-col gap-1 text-sm text-muted">
              <li>{t("pages.aiAnalysis.clarificationHeading")}</li>
              <li>{t("pages.aiAnalysis.requirementsHeading")}</li>
              <li>{t("pages.aiAnalysis.catalogHeading")}</li>
              <li>{t("pages.aiAnalysis.risksHeading")}</li>
              <li>{t("pages.aiAnalysis.testAndDocumentNeedsItem")}</li>
            </ul>
          </div>
        </SectionCard>
      )}

      {status === "preview" && (
        <SectionCard>
          <p className="text-sm text-text">{t("pages.aiAnalysis.consentNotice")}</p>
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => void confirmAndSend(projectId, new HttpAIAnalysisClient())}
            >
              {t("pages.aiAnalysis.sendAction")}
            </Button>
            <Button variant="secondary" onClick={cancel}>
              {t("pages.aiAnalysis.cancelAction")}
            </Button>
          </div>
        </SectionCard>
      )}

      {status === "sending" && <LoadingState label={t("pages.aiAnalysis.sendingNotice")} />}

      {result && (
        <div className="flex flex-col gap-6">
          {status === "idle" && (
            <Button
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => buildPreview(projectId)}
            >
              {t("pages.aiAnalysis.reanalyzeAction")}
            </Button>
          )}

          <SectionCard title={t("pages.aiAnalysis.classificationHeading")}>
            <p className="text-sm text-muted">
              {t("pages.aiAnalysis.complexityLabel")}: {result.classification.complexity} ·{" "}
              {t("pages.aiAnalysis.confidenceLabel")}:{" "}
              {Math.round(result.classification.confidence * 100)}%
            </p>
          </SectionCard>

          {result.clarificationQuestions.length > 0 && (
            <SectionCard title={t("pages.aiAnalysis.clarificationHeading")}>
              <ul className="flex flex-col gap-2">
                {result.clarificationQuestions.map((question) => (
                  <li
                    key={question.id}
                    className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm"
                  >
                    <p className="text-text">{question.question}</p>
                    <p className="text-xs text-muted">{question.reason}</p>
                    <ReviewActions
                      decision={decisionFor("clarification", question.id)}
                      onAccept={() => reviewClarification(projectId, question.id, "accepted")}
                      onReject={() => reviewClarification(projectId, question.id, "rejected")}
                      t={t}
                    />
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {result.proposedRequirements.length > 0 && (
            <SectionCard title={t("pages.aiAnalysis.requirementsHeading")}>
              <ul className="flex flex-col gap-2">
                {result.proposedRequirements.map((proposal) => (
                  <li
                    key={proposal.id}
                    className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm"
                  >
                    <p className="font-medium text-text">{proposal.title}</p>
                    <p className="text-xs text-muted">{proposal.description}</p>
                    <p className="text-xs text-muted">{proposal.reason}</p>
                    <ReviewActions
                      decision={decisionFor("requirement", proposal.id)}
                      onAccept={() => void acceptRequirementProposal(projectId, proposal)}
                      onReject={() => rejectRequirementProposal(projectId, proposal)}
                      t={t}
                    />
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {result.recommendedItemIds.length > 0 && (
            <SectionCard title={t("pages.aiAnalysis.catalogHeading")}>
              <ul className="flex flex-col gap-2">
                {result.recommendedItemIds.map((itemId) => (
                  <li
                    key={itemId}
                    className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm"
                  >
                    <p className="font-medium text-text">{catalogItemName(itemId)}</p>
                    <ReviewActions
                      decision={decisionFor("catalogItem", itemId)}
                      onAccept={() => void acceptCatalogRecommendation(projectId, itemId)}
                      onReject={() => rejectCatalogRecommendation(projectId, itemId)}
                      t={t}
                    />
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {result.customProposals.length > 0 && (
            <SectionCard title={t("pages.aiAnalysis.customProposalsHeading")}>
              <ul className="flex flex-col gap-2">
                {result.customProposals.map((proposal) => (
                  <li
                    key={proposal.name}
                    className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm"
                  >
                    <p className="font-medium text-text">
                      {proposal.name}{" "}
                      <Badge tone="neutral">{t("pages.aiAnalysis.unverifiedBadge")}</Badge>
                    </p>
                    <p className="text-xs text-muted">{proposal.reason}</p>
                    <ReviewActions
                      decision={decisionFor("customProposal", proposal.name)}
                      onAccept={() => void acceptCustomProposal(projectId, proposal)}
                      onReject={() => rejectCustomProposal(projectId, proposal)}
                      t={t}
                    />
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {result.risks.length > 0 && (
            <ReviewListSection
              heading={t("pages.aiAnalysis.risksHeading")}
              items={result.risks}
              category="risk"
              reviewed={reviewed}
              onDecide={(item, decision) => reviewRisk(projectId, item, decision)}
              t={t}
            />
          )}

          {result.testNeeds.length > 0 && (
            <ReviewListSection
              heading={t("pages.aiAnalysis.testNeedsHeading")}
              items={result.testNeeds}
              category="testNeed"
              reviewed={reviewed}
              onDecide={(item, decision) => reviewTestNeed(projectId, item, decision)}
              t={t}
            />
          )}

          {result.documentNeeds.length > 0 && (
            <ReviewListSection
              heading={t("pages.aiAnalysis.documentNeedsHeading")}
              items={result.documentNeeds}
              category="documentNeed"
              reviewed={reviewed}
              onDecide={(item, decision) => reviewDocumentNeed(projectId, item, decision)}
              t={t}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface ReviewActionsProps {
  decision: "accepted" | "rejected" | undefined;
  onAccept: () => void;
  onReject: () => void;
  t: (key: string) => string;
}

function ReviewActions({ decision, onAccept, onReject, t }: ReviewActionsProps) {
  if (decision) {
    return (
      <p className="text-xs font-medium text-muted">
        {decision === "accepted"
          ? t("pages.aiAnalysis.acceptedLabel")
          : t("pages.aiAnalysis.rejectedLabel")}
      </p>
    );
  }
  return (
    <div className="flex gap-3">
      <button type="button" onClick={onAccept} className={actionLinkClasses("primary", "sm")}>
        {t("pages.aiAnalysis.acceptAction")}
      </button>
      <button type="button" onClick={onReject} className={actionLinkClasses("primary", "sm")}>
        {t("pages.aiAnalysis.rejectAction")}
      </button>
    </div>
  );
}

interface ReviewListSectionProps {
  heading: string;
  items: string[];
  category: AIReviewCategory;
  reviewed: Partial<Record<AIReviewCategory, Record<string, "accepted" | "rejected">>> | undefined;
  onDecide: (item: string, decision: "accepted" | "rejected") => void;
  t: (key: string) => string;
}

function ReviewListSection({
  heading,
  items,
  category,
  reviewed,
  onDecide,
  t,
}: ReviewListSectionProps) {
  return (
    <SectionCard title={heading}>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm"
          >
            <p className="text-text">{item}</p>
            <ReviewActions
              decision={reviewed?.[category]?.[item]}
              onAccept={() => onDecide(item, "accepted")}
              onReject={() => onDecide(item, "rejected")}
              t={t}
            />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
