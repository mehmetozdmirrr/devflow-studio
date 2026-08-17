import type { ProjectStatus } from "@contracts/project";

import type { BadgeTone } from "../ui/Badge";

/** Presentation-only mapping (i18n label key + badge tone) for `ProjectStatus` — not a domain rule, just display metadata shared by ProjectsPage/ProjectOverviewPage/ProjectContextNav. */
export const PROJECT_STATUS_LABEL_KEYS: Record<ProjectStatus, string> = {
  draft: "pages.projects.statusBadgeDraft",
  configured: "pages.projects.statusBadgeConfigured",
  validated: "pages.projects.statusBadgeValidated",
  generated: "pages.projects.statusBadgeGenerated",
  archived: "pages.projects.statusBadgeArchived",
  trashed: "pages.projects.statusBadgeTrashed",
};

export const PROJECT_STATUS_TONES: Record<ProjectStatus, BadgeTone> = {
  draft: "neutral",
  configured: "info",
  validated: "success",
  generated: "success",
  archived: "warning",
  trashed: "danger",
};
