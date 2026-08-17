import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { selectTrashedProjects, useProjectsStore } from "../application/projectsStore";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";

interface PendingDelete {
  id: string;
  name: string;
}

const NOTICE_TIMEOUT_MS = 6000;

export function TrashPage() {
  const { t, i18n } = useTranslation();
  const hydrated = useProjectsStore((state) => state.hydrated);
  const loadError = useProjectsStore((state) => state.loadError);
  const hydrate = useProjectsStore((state) => state.hydrate);
  const trashedProjects = useProjectsStore(useShallow(selectTrashedProjects));
  const restoreFromTrash = useProjectsStore((state) => state.restoreFromTrash);
  const permanentlyDelete = useProjectsStore((state) => state.permanentlyDelete);

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  if (!hydrated) return <LoadingState />;
  if (loadError) {
    return <ErrorState body={t("pages.projects.errorBody")} onRetry={() => void hydrate()} />;
  }

  async function handleRestore(id: string, name: string): Promise<void> {
    await restoreFromTrash(id);
    setRestoredNotice(name);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setRestoredNotice(null), NOTICE_TIMEOUT_MS);
  }

  function openDeleteDialog(id: string, name: string): void {
    setPendingDelete({ id, name });
    setConfirmText("");
    setMismatch(false);
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!pendingDelete) return;
    if (confirmText !== pendingDelete.name) {
      setMismatch(true);
      return;
    }
    await permanentlyDelete(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("pages.trash.title")} />

      {restoredNotice && (
        <p role="status" className="text-sm text-muted">
          {t("pages.trash.restoreNotice", { name: restoredNotice })}
        </p>
      )}

      {trashedProjects.length === 0 ? (
        <EmptyState title={t("pages.trash.emptyTitle")} body={t("pages.trash.emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {trashedProjects.map((project) => (
            <li
              key={project.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <div className="flex flex-col">
                <span className="font-medium text-text">{project.meta.name}</span>
                {project.trashedAt && (
                  <span className="text-xs text-muted">
                    {t("pages.trash.trashedAt", {
                      date: new Date(project.trashedAt).toLocaleString(i18n.language),
                    })}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleRestore(project.id, project.meta.name)}
                >
                  {t("pages.trash.restoreAction")}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => openDeleteDialog(project.id, project.meta.name)}
                >
                  {t("pages.trash.deleteAction")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("pages.trash.deleteConfirmTitle", { name: pendingDelete?.name ?? "" })}
        confirmLabel={t("pages.trash.deleteAction")}
        destructive
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
        body={
          pendingDelete && (
            <div className="flex flex-col gap-2">
              <p>{t("pages.trash.deleteConfirmBody")}</p>
              <label
                className="flex flex-col gap-1 text-sm text-text"
                htmlFor="trash-delete-confirm-input"
              >
                {t("pages.trash.deleteConfirmLabel", { name: pendingDelete.name })}
                <input
                  id="trash-delete-confirm-input"
                  type="text"
                  value={confirmText}
                  onChange={(event) => {
                    setConfirmText(event.target.value);
                    setMismatch(false);
                  }}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-text"
                />
              </label>
              {mismatch && (
                <span className="text-xs text-danger">
                  {t("pages.trash.deleteConfirmMismatch")}
                </span>
              )}
            </div>
          )
        }
      />
    </div>
  );
}
