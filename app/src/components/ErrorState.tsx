import { useTranslation } from "react-i18next";

interface ErrorStateProps {
  title?: string;
  body?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, body, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-danger/40 bg-surface p-8 text-center"
    >
      <h2 className="text-lg font-semibold text-text">{title ?? t("common.errorTitle")}</h2>
      <p className="max-w-prose text-muted">{body ?? t("common.errorBody")}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-primary-interactive px-4 py-2 text-on-primary hover:opacity-90"
        >
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
