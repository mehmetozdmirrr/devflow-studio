import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

const LINKS = [
  { to: "/projects", key: "nav.projects" },
  { to: "/catalog", key: "nav.catalog" },
  { to: "/compare", key: "nav.compare" },
  { to: "/trash", key: "nav.trash" },
  { to: "/settings", key: "nav.settings" },
] as const;

export function NavBar() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("app.name")} className="flex flex-wrap gap-1">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            `rounded-md px-3 py-2 text-sm font-medium ${
              isActive ? "bg-surface text-text" : "text-muted hover:text-text"
            }`
          }
        >
          {t(link.key)}
        </NavLink>
      ))}
    </nav>
  );
}
