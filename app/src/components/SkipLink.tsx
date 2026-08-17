import { useTranslation } from "react-i18next";

export function SkipLink() {
  const { t } = useTranslation();
  return (
    <a href="#main-content" className="skip-link">
      {t("nav.skipToContent")}
    </a>
  );
}
