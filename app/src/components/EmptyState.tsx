import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface EmptyStateProps {
  title?: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ title, body, action }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center">
      <h2 className="text-lg font-semibold text-text">{title ?? t("common.emptyTitle")}</h2>
      <p className="max-w-prose text-muted">{body ?? t("common.emptyBody")}</p>
      {action}
    </div>
  );
}
