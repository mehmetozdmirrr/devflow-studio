import { Link } from "react-router";
import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold text-text">{t("notFound.title")}</h1>
      <p className="max-w-prose text-muted">{t("notFound.body")}</p>
      <Link
        to="/"
        className="rounded-md bg-primary-interactive px-4 py-2 font-medium text-on-primary hover:opacity-90"
      >
        {t("notFound.backHome")}
      </Link>
    </div>
  );
}
