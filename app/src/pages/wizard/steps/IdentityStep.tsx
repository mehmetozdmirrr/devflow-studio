import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Project } from "@contracts/project";

import { useProjectsStore } from "../../../application/projectsStore";
import { IdentityFields } from "../../../components/IdentityFields";
import { validateCreateProjectInput, type ProjectFieldErrors } from "../../../domain/project";

interface IdentityStepProps {
  project: Project;
}

type IdentityField = "name" | "idea" | "problem" | "proposedSolution";

/** Always-reachable identity/brief editing step for an existing project — reuses the same fields and validators as first creation (`ProjectCreatePage`), never a dangling routing gap. */
export function IdentityStep({ project }: IdentityStepProps) {
  const { t } = useTranslation();
  const updateProjectDraft = useProjectsStore((state) => state.updateProjectDraft);
  const [errors, setErrors] = useState<ProjectFieldErrors>({});

  function handleChange(field: IdentityField, value: string): void {
    updateProjectDraft(project.id, { [field]: value });
    setErrors(
      validateCreateProjectInput({
        name: field === "name" ? value : project.meta.name,
        idea: field === "idea" ? value : project.brief.idea,
        problem: field === "problem" ? value : project.brief.problem,
        proposedSolution: field === "proposedSolution" ? value : project.brief.proposedSolution,
        experienceProfile: project.configuration.experienceProfile,
      }),
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm text-muted">{t("wizard.identity.description")}</p>
      <IdentityFields
        idPrefix="wizard-identity"
        name={project.meta.name}
        idea={project.brief.idea}
        problem={project.brief.problem}
        proposedSolution={project.brief.proposedSolution}
        errors={errors}
        onNameChange={(value) => handleChange("name", value)}
        onIdeaChange={(value) => handleChange("idea", value)}
        onProblemChange={(value) => handleChange("problem", value)}
        onProposedSolutionChange={(value) => handleChange("proposedSolution", value)}
      />
    </div>
  );
}
