import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { NavBar } from "../NavBar";

/** Shared brand + global nav row, reused by both MarketingShell and WorkspaceShell so every surface keeps one consistent product identity. */
export function SiteHeader() {
  const { t } = useTranslation();
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="text-lg font-semibold text-text">
          {t("app.name")}
        </Link>
        <NavBar />
      </div>
    </header>
  );
}
