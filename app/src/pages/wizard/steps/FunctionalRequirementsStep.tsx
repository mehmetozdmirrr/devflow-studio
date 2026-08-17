import { useTranslation } from "react-i18next";
import type { Project } from "@contracts/project";

import { useProjectsStore } from "../../../application/projectsStore";
import { RequirementsPanel } from "../../../components/RequirementsPanel";

interface FunctionalRequirementsStepProps {
  project: Project;
}

/** FR-013/014: functional requirements CRUD. */
export function FunctionalRequirementsStep({ project }: FunctionalRequirementsStepProps) {
  const { t } = useTranslation();
  const updateProjectDraft = useProjectsStore((state) => state.updateProjectDraft);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("wizard.functionalRequirements.description")}</p>
      <RequirementsPanel
        idPrefix="wizard-functional-requirement"
        requirements={project.requirements}
        allowedTypes={["functional"]}
        onChange={(requirements) => updateProjectDraft(project.id, { requirements })}
      />
    </div>
  );
}
