import { useEffect } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

import { useProjectsStore } from "../../application/projectsStore";
import { computeResumeStepId } from "../../domain/wizardSteps";
import { Badge } from "../ui/Badge";
import { PROJECT_STATUS_LABEL_KEYS, PROJECT_STATUS_TONES } from "./projectStatusBadge";

interface ProjectContextNavProps {
  projectId: string;
}

const LINK_CLASSES = ({ isActive }: { isActive: boolean }): string =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? "bg-primary-interactive text-on-primary" : "text-muted hover:text-text"
  }`;

/** Persistent compact nav shown only on /projects/:projectId/* routes — links to the 4 existing project destinations (no new routes). */
export function ProjectContextNav({ projectId }: ProjectContextNavProps) {
  const { t } = useTranslation();
  const hydrated = useProjectsStore((state) => state.hydrated);
  const hydrate = useProjectsStore((state) => state.hydrate);
  const project = useProjectsStore((state) =>
    state.projects.find((candidate) => candidate.id === projectId),
  );

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  if (!project) return null;

  return (
    <div className="border-b border-border bg-surface/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <span className="truncate text-sm font-medium text-text">{project.meta.name}</span>
        <Badge tone={PROJECT_STATUS_TONES[project.status]}>
          {t(PROJECT_STATUS_LABEL_KEYS[project.status])}
        </Badge>
        <nav aria-label={t("projectNav.label")} className="flex flex-wrap gap-1">
          <NavLink to={`/projects/${projectId}`} end className={LINK_CLASSES}>
            {t("projectNav.overview")}
          </NavLink>
          <NavLink
            to={`/projects/${projectId}/wizard/${computeResumeStepId(project)}`}
            className={LINK_CLASSES}
          >
            {t("projectNav.configure")}
          </NavLink>
          <NavLink to={`/projects/${projectId}/ai`} className={LINK_CLASSES}>
            {t("projectNav.aiAnalysis")}
          </NavLink>
          <NavLink to={`/projects/${projectId}/package`} className={LINK_CLASSES}>
            {t("projectNav.package")}
          </NavLink>
        </nav>
      </div>
    </div>
  );
}
