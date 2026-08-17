import { useTranslation } from "react-i18next";

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 p-6 text-muted">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary"
      />
      <span>{label ?? t("common.loading")}</span>
    </div>
  );
}
