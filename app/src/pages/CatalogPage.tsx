import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type { CatalogItem, CatalogItemKind } from "@contracts/catalog";
import type {
  CatalogOrigin,
  Difficulty,
  ExperienceProfile,
  Identifier,
  Maturity,
  VerificationStatus,
} from "@contracts/common";

import {
  selectAllCatalogItems,
  selectVisibleCatalogItems,
  useCatalogStore,
  type CreateUserItemResult,
} from "../application/catalogStore";
import { useProjectsStore, selectVisibleProjects } from "../application/projectsStore";
import { useSettingsStore } from "../application/settingsStore";
import {
  CATALOG_ITEM_KINDS,
  collectSupportedPlatforms,
  hasActiveCatalogFilters,
  isSystemItem,
  type CatalogItemFieldErrors,
  type UserCatalogItemInput,
} from "../domain/catalog";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CatalogItemForm } from "../components/CatalogItemForm";
import { PageHeader } from "../components/layout/PageHeader";
import { MainPane, WorkspaceGrid, InspectorPanel } from "../components/layout/WorkspaceGrid";
import { SectionCard } from "../components/ui/SectionCard";
import { Badge } from "../components/ui/Badge";
import { Button, actionLinkClasses } from "../components/ui/Button";

const PAGE_SIZE = 12;

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];
const MATURITIES: Maturity[] = ["stable", "preview", "experimental", "deprecated"];
const ORIGINS: CatalogOrigin[] = ["system", "user", "imported"];
const VERIFICATIONS: VerificationStatus[] = ["verified", "unverified"];
const PROFILES: ExperienceProfile[] = ["beginner", "intermediate", "advanced", "team"];

function emptyFormInput(): UserCatalogItemInput {
  return {
    name: "",
    shortDescriptionEn: "",
    shortDescriptionTr: "",
    descriptionEn: "",
    descriptionTr: "",
    kind: "library",
    domainIds: [],
    tags: [],
    supportedPlatforms: [],
    difficulty: "intermediate",
  };
}

function formInputFromItem(item: CatalogItem): UserCatalogItemInput {
  return {
    name: item.name,
    shortDescriptionEn: item.shortDescription.en,
    shortDescriptionTr: item.shortDescription.tr,
    descriptionEn: item.description.en,
    descriptionTr: item.description.tr,
    kind: item.kind,
    domainIds: item.domainIds,
    tags: item.tags,
    supportedPlatforms: item.supportedPlatforms,
    difficulty: item.difficulty,
  };
}

export function CatalogPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const hydrated = useCatalogStore((state) => state.hydrated);
  const loadError = useCatalogStore((state) => state.loadError);
  const hydrate = useCatalogStore((state) => state.hydrate);
  const allItems = useCatalogStore(useShallow(selectAllCatalogItems));
  const visibleItems = useCatalogStore(useShallow(selectVisibleCatalogItems));
  const filters = useCatalogStore((state) => state.filters);
  const setFilters = useCatalogStore((state) => state.setFilters);
  const resetFilters = useCatalogStore((state) => state.resetFilters);
  const selectedItemId = useCatalogStore((state) => state.selectedItemId);
  const selectItem = useCatalogStore((state) => state.selectItem);
  const compareItemIds = useCatalogStore((state) => state.compareItemIds);
  const compareError = useCatalogStore((state) => state.compareError);
  const toggleCompare = useCatalogStore((state) => state.toggleCompare);
  const dismissCompareError = useCatalogStore((state) => state.dismissCompareError);
  const createUserItem = useCatalogStore((state) => state.createUserItem);
  const updateUserItem = useCatalogStore((state) => state.updateUserItem);
  const deleteUserItem = useCatalogStore((state) => state.deleteUserItem);
  const cloneSystemItem = useCatalogStore((state) => state.cloneSystemItem);
  const exportUserCatalog = useCatalogStore((state) => state.exportUserCatalog);
  const commitImportUserCatalog = useCatalogStore((state) => state.commitImportUserCatalog);
  const addItemToProject = useCatalogStore((state) => state.addItemToProject);

  const favoriteIds = useSettingsStore((state) => state.settings.favoriteCatalogItemIds);
  const toggleFavorite = useSettingsStore((state) => state.toggleFavoriteCatalogItem);

  const projectsHydrated = useProjectsStore((state) => state.hydrated);
  const hydrateProjects = useProjectsStore((state) => state.hydrate);
  const projects = useProjectsStore(useShallow(selectVisibleProjects));

  const [isCreating, setIsCreating] = useState(false);
  const [editingItemId, setEditingItemId] = useState<Identifier | null>(null);
  const [formErrors, setFormErrors] = useState<CatalogItemFieldErrors>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<Identifier | null>(null);
  const [addToProjectItemId, setAddToProjectItemId] = useState<Identifier | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string>("");
  const [importError, setImportError] = useState<"file" | "shape" | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [pageResetFilters, setPageResetFilters] = useState(filters);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!projectsHydrated) void hydrateProjects();
  }, [projectsHydrated, hydrateProjects]);

  // Presentation-only pagination state — reset to page 1 whenever the filtered result set changes
  // (search/filter change). Adjusted during render (React's documented pattern for resetting
  // state when a prop/value changes) rather than in an effect, since `setFilters` always produces
  // a new object reference on an actual change.
  if (filters !== pageResetFilters) {
    setPageResetFilters(filters);
    setPage(1);
  }

  if (!hydrated) return <LoadingState />;
  if (loadError) {
    return <ErrorState body={t("pages.catalog.errorBody")} onRetry={() => void hydrate()} />;
  }

  const selectedItem = allItems.find((item) => item.id === selectedItemId) ?? null;
  const platforms = collectSupportedPlatforms(allItems);
  const activeFilters = hasActiveCatalogFilters(filters);
  const pageCount = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedItems = visibleItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    (currentPage - 1) * PAGE_SIZE + PAGE_SIZE,
  );
  const rangeStart = visibleItems.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, visibleItems.length);

  async function handleCreateSubmit(input: UserCatalogItemInput): Promise<void> {
    const result: CreateUserItemResult = await createUserItem(input);
    if (!result.ok) {
      setFormErrors(result.errors);
      return;
    }
    setFormErrors({});
    setIsCreating(false);
    selectItem(result.item.id);
  }

  async function handleEditSubmit(input: UserCatalogItemInput): Promise<void> {
    if (!editingItemId) return;
    const result = await updateUserItem(editingItemId, input);
    if (!result.ok) {
      setFormErrors(result.errors);
      return;
    }
    setFormErrors({});
    setEditingItemId(null);
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!pendingDeleteId) return;
    await deleteUserItem(pendingDeleteId);
    setPendingDeleteId(null);
  }

  async function handleClone(itemId: Identifier): Promise<void> {
    const clone = await cloneSystemItem(itemId);
    if (clone) selectItem(clone.id);
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
    const result = await commitImportUserCatalog(parsed);
    if (!result.ok) {
      setImportError("shape");
      return;
    }
    setImportError(null);
    setImportSummary(
      t("pages.catalog.importSummary", { added: result.addedCount, skipped: result.skippedCount }),
    );
  }

  async function handleConfirmAddToProject(): Promise<void> {
    if (!addToProjectItemId || !targetProjectId) return;
    await addItemToProject(addToProjectItemId, targetProjectId);
    setAddToProjectItemId(null);
    setTargetProjectId("");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("pages.catalog.title")}
        actions={
          <>
            {compareItemIds.length >= 2 && (
              <Button variant="primary" onClick={() => navigate("/compare")}>
                {t("pages.catalog.compareAction", { count: compareItemIds.length })}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreating(true);
                setEditingItemId(null);
                setFormErrors({});
              }}
            >
              {t("pages.catalog.createAction")}
            </Button>
            <Button variant="secondary" onClick={exportUserCatalog}>
              {t("pages.catalog.exportAction")}
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              {t("pages.catalog.importAction")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              aria-label={t("pages.catalog.importFileLabel")}
              onChange={(event) => void handleFileSelected(event)}
            />
          </>
        }
      />

      {importError === "file" && <ErrorState body={t("pages.catalog.importInvalidFile")} />}
      {importError === "shape" && <ErrorState body={t("pages.catalog.importInvalidShape")} />}
      {importSummary && (
        <p role="status" className="text-sm text-muted">
          {importSummary}
        </p>
      )}
      {compareError && (
        <p role="alert" className="text-sm text-danger">
          {t(`pages.catalog.compareError.${compareError}`)}{" "}
          <button type="button" onClick={dismissCompareError} className="underline">
            {t("common.close")}
          </button>
        </p>
      )}

      {isCreating && (
        <SectionCard>
          <CatalogItemForm
            idPrefix="catalog-create"
            initial={emptyFormInput()}
            errors={formErrors}
            submitLabel={t("pages.catalog.form.createSubmit")}
            onSubmit={(input) => void handleCreateSubmit(input)}
            onCancel={() => {
              setIsCreating(false);
              setFormErrors({});
            }}
          />
        </SectionCard>
      )}

      {editingItemId && selectedItem && (
        <SectionCard>
          <CatalogItemForm
            idPrefix="catalog-edit"
            initial={formInputFromItem(selectedItem)}
            errors={formErrors}
            submitLabel={t("pages.catalog.form.editSubmit")}
            onSubmit={(input) => void handleEditSubmit(input)}
            onCancel={() => {
              setEditingItemId(null);
              setFormErrors({});
            }}
          />
        </SectionCard>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3">
        <label className="flex flex-col gap-1 text-sm text-text" htmlFor="catalog-search-input">
          {t("pages.catalog.searchLabel")}
          <input
            id="catalog-search-input"
            type="search"
            value={filters.query}
            placeholder={t("pages.catalog.searchPlaceholder")}
            onChange={(event) => setFilters({ query: event.target.value })}
            className="w-52 rounded-md border border-border bg-background px-3 py-1.5 text-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text" htmlFor="catalog-kind-filter">
          {t("pages.catalog.kindFilterLabel")}
          <select
            id="catalog-kind-filter"
            value={filters.kind}
            onChange={(event) =>
              setFilters({ kind: event.target.value as CatalogItemKind | "all" })
            }
            className="rounded-md border border-border bg-surface px-3 py-2 text-text"
          >
            <option value="all">{t("common.all")}</option>
            {CATALOG_ITEM_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`catalog.kind.${kind}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text" htmlFor="catalog-platform-filter">
          {t("pages.catalog.platformFilterLabel")}
          <select
            id="catalog-platform-filter"
            value={filters.platform}
            onChange={(event) => setFilters({ platform: event.target.value })}
            className="rounded-md border border-border bg-surface px-3 py-2 text-text"
          >
            <option value="all">{t("common.all")}</option>
            {platforms.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text" htmlFor="catalog-profile-filter">
          {t("pages.catalog.profileFilterLabel")}
          <select
            id="catalog-profile-filter"
            value={filters.profile}
            onChange={(event) =>
              setFilters({ profile: event.target.value as ExperienceProfile | "all" })
            }
            className="rounded-md border border-border bg-surface px-3 py-2 text-text"
          >
            <option value="all">{t("common.all")}</option>
            {PROFILES.map((profile) => (
              <option key={profile} value={profile}>
                {t(`catalog.profile.${profile}`)}
              </option>
            ))}
          </select>
        </label>
        <label
          className="flex flex-col gap-1 text-sm text-text"
          htmlFor="catalog-difficulty-filter"
        >
          {t("pages.catalog.difficultyFilterLabel")}
          <select
            id="catalog-difficulty-filter"
            value={filters.difficulty}
            onChange={(event) =>
              setFilters({ difficulty: event.target.value as Difficulty | "all" })
            }
            className="rounded-md border border-border bg-surface px-3 py-2 text-text"
          >
            <option value="all">{t("common.all")}</option>
            {DIFFICULTIES.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {t(`catalog.difficulty.${difficulty}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text" htmlFor="catalog-maturity-filter">
          {t("pages.catalog.maturityFilterLabel")}
          <select
            id="catalog-maturity-filter"
            value={filters.maturity}
            onChange={(event) => setFilters({ maturity: event.target.value as Maturity | "all" })}
            className="rounded-md border border-border bg-surface px-3 py-2 text-text"
          >
            <option value="all">{t("common.all")}</option>
            {MATURITIES.map((maturity) => (
              <option key={maturity} value={maturity}>
                {t(`catalog.maturity.${maturity}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text" htmlFor="catalog-origin-filter">
          {t("pages.catalog.originFilterLabel")}
          <select
            id="catalog-origin-filter"
            value={filters.origin}
            onChange={(event) =>
              setFilters({ origin: event.target.value as CatalogOrigin | "all" })
            }
            className="rounded-md border border-border bg-surface px-3 py-2 text-text"
          >
            <option value="all">{t("common.all")}</option>
            {ORIGINS.map((origin) => (
              <option key={origin} value={origin}>
                {t(`catalog.origin.${origin}`)}
              </option>
            ))}
          </select>
        </label>
        <label
          className="flex flex-col gap-1 text-sm text-text"
          htmlFor="catalog-verification-filter"
        >
          {t("pages.catalog.verificationFilterLabel")}
          <select
            id="catalog-verification-filter"
            value={filters.verification}
            onChange={(event) =>
              setFilters({ verification: event.target.value as VerificationStatus | "all" })
            }
            className="rounded-md border border-border bg-surface px-3 py-2 text-text"
          >
            <option value="all">{t("common.all")}</option>
            {VERIFICATIONS.map((verification) => (
              <option key={verification} value={verification}>
                {t(`catalog.verification.${verification}`)}
              </option>
            ))}
          </select>
        </label>
        {activeFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-sm font-medium text-primary-text underline-offset-2 hover:underline"
          >
            {t("pages.catalog.clearFilters")}
          </button>
        )}
      </div>

      {visibleItems.length === 0 && (
        <EmptyState
          title={t("pages.catalog.noResultsTitle")}
          body={t("pages.catalog.noResultsBody")}
          action={
            <div className="flex gap-3">
              {activeFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text hover:bg-surface"
                >
                  {t("pages.catalog.clearFilters")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="rounded-md bg-primary-interactive px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90"
              >
                {t("pages.catalog.createAction")}
              </button>
            </div>
          }
        />
      )}

      <WorkspaceGrid>
        <MainPane>
          {visibleItems.length > 0 && (
            <p className="text-sm text-muted">
              {t("pages.catalog.resultCount", {
                from: rangeStart,
                to: rangeEnd,
                total: visibleItems.length,
              })}
            </p>
          )}
          {visibleItems.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pagedItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex flex-col gap-2 rounded-lg border p-4 ${
                    selectedItemId === item.id ? "border-primary-text" : "border-border"
                  } bg-surface`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => selectItem(item.id)}
                      className="text-left font-medium text-text hover:underline"
                    >
                      {item.name}
                    </button>
                    <Badge tone="neutral" className="shrink-0">
                      {t(`catalog.kind.${item.kind}`)}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted">{item.shortDescription.en}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge tone="neutral">
                      {t(
                        item.origin === "system"
                          ? "catalog.badge.systemVerified"
                          : item.verification === "unverified"
                            ? "catalog.badge.unverified"
                            : `catalog.origin.${item.origin}`,
                      )}
                    </Badge>
                    {item.maturity === "deprecated" && (
                      <Badge tone="danger">{t("catalog.badge.deprecated")}</Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => void toggleFavorite(item.id)}
                      className={actionLinkClasses(
                        favoriteIds.includes(item.id) ? "primary" : "neutral",
                        "sm",
                      )}
                    >
                      {favoriteIds.includes(item.id)
                        ? t("pages.catalog.unfavoriteAction")
                        : t("pages.catalog.favoriteAction")}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCompare(item.id)}
                      className={actionLinkClasses(
                        compareItemIds.includes(item.id) ? "primary" : "neutral",
                        "sm",
                      )}
                    >
                      {compareItemIds.includes(item.id)
                        ? t("pages.catalog.removeCompareAction")
                        : t("pages.catalog.addCompareAction")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pageCount > 1 && (
            <nav
              aria-label={t("pages.catalog.pagination.label")}
              className="flex items-center justify-center gap-3"
            >
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                {t("pages.catalog.pagination.previous")}
              </Button>
              <span role="status" className="text-sm text-muted">
                {t("pages.catalog.pagination.pageStatus", {
                  current: currentPage,
                  total: pageCount,
                })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                {t("pages.catalog.pagination.next")}
              </Button>
            </nav>
          )}
        </MainPane>

        {selectedItem && (
          <InspectorPanel width="lg" aria-label={selectedItem.name}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-text">{selectedItem.name}</h2>
              <button
                type="button"
                onClick={() => selectItem(null)}
                aria-label={t("common.close")}
                className="text-muted hover:text-text"
              >
                &times;
              </button>
            </div>
            <dl className="mt-3 flex flex-col gap-2 text-sm text-text">
              <div>
                <dt className="text-xs text-muted">{t("pages.catalog.detail.description")}</dt>
                <dd>{selectedItem.description.en}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("pages.catalog.detail.applicability")}</dt>
                <dd>
                  {selectedItem.domainIds.length > 0
                    ? selectedItem.domainIds.join(", ")
                    : t("pages.catalog.detail.notAvailable")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("pages.catalog.detail.maturity")}</dt>
                <dd>{t(`catalog.maturity.${selectedItem.maturity}`)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("pages.catalog.detail.difficulty")}</dt>
                <dd>{t(`catalog.difficulty.${selectedItem.difficulty}`)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("pages.catalog.detail.source")}</dt>
                <dd>
                  {t(`catalog.origin.${selectedItem.origin}`)} ·{" "}
                  {t(`catalog.verification.${selectedItem.verification}`)}
                </dd>
              </div>
              {selectedItem.relations.length > 0 && (
                <div>
                  <dt className="text-xs text-muted">{t("pages.catalog.detail.relations")}</dt>
                  <dd>
                    <ul className="flex flex-col gap-1">
                      {selectedItem.relations.map((relation) => (
                        <li key={`${relation.type}-${relation.targetId}`}>
                          <span className="font-medium">
                            {t(`catalog.relation.${relation.type}`)}
                          </span>{" "}
                          {relation.targetId} — {relation.reason.en}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              {selectedItem.documentation?.url && (
                <div>
                  <dt className="text-xs text-muted">{t("pages.catalog.detail.documentation")}</dt>
                  <dd>
                    <a
                      href={selectedItem.documentation.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-text underline-offset-2 hover:underline"
                    >
                      {selectedItem.documentation.label}
                    </a>
                  </dd>
                </div>
              )}
              {selectedItem.recommendation.reasons.length > 0 && (
                <div>
                  <dt className="text-xs text-muted">{t("pages.catalog.detail.rationale")}</dt>
                  <dd>
                    <ul className="list-disc pl-4">
                      {selectedItem.recommendation.reasons.map((reason) => (
                        <li key={reason.en}>{reason.en}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {isSystemItem(selectedItem) ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleClone(selectedItem.id)}
                >
                  {t("pages.catalog.cloneAction")}
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditingItemId(selectedItem.id);
                      setIsCreating(false);
                      setFormErrors({});
                    }}
                  >
                    {t("pages.catalog.editAction")}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setPendingDeleteId(selectedItem.id)}
                  >
                    {t("pages.catalog.deleteAction")}
                  </Button>
                </>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => setAddToProjectItemId(selectedItem.id)}
              >
                {t("pages.catalog.addToProjectAction")}
              </Button>
            </div>
          </InspectorPanel>
        )}
      </WorkspaceGrid>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={t("pages.catalog.deleteConfirmTitle")}
        body={t("pages.catalog.deleteConfirmBody")}
        confirmLabel={t("pages.catalog.deleteAction")}
        destructive
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDeleteId(null)}
      />

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
            <label className="flex flex-col gap-1 text-sm" htmlFor="catalog-add-to-project-select">
              {t("pages.catalog.addToProjectSelectLabel")}
              <select
                id="catalog-add-to-project-select"
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
