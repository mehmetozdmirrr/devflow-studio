import type { ReactNode } from "react";
import { Link } from "react-router";

import { actionLinkClasses } from "../ui/Button";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  back?: { to: string; label: string };
  meta?: ReactNode;
  actions?: ReactNode;
}

/** Shared page-title/action-row header — replaces the `<h1>` + `flex justify-between` block duplicated across every page. */
export function PageHeader({ title, description, back, meta, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {back && (
        <Link to={back.to} className={`w-fit ${actionLinkClasses("primary", "sm")}`}>
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-text">{title}</h1>
            {meta}
          </div>
          {description && <p className="max-w-2xl text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </div>
  );
}
