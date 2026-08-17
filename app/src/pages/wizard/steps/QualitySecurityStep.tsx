import { useTranslation } from "react-i18next";
import type { Project } from "@contracts/project";

import { useProjectsStore } from "../../../application/projectsStore";
import { RequirementsPanel } from "../../../components/RequirementsPanel";

interface QualitySecurityStepProps {
  project: Project;
}

/** FR-013/014: non-functional (quality/security/deployment) and constraint requirements CRUD. */
export function QualitySecurityStep({ project }: QualitySecurityStepProps) {
  const { t } = useTranslation();
  const updateProjectDraft = useProjectsStore((state) => state.updateProjectDraft);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("wizard.qualitySecurity.description")}</p>
      <RequirementsPanel
        idPrefix="wizard-quality-security-requirement"
        requirements={project.requirements}
        allowedTypes={["non-functional", "constraint"]}
        onChange={(requirements) => updateProjectDraft(project.id, { requirements })}
      />
    </div>
  );
}
