import { useTranslation } from "react-i18next";

import type { ProjectFieldErrors } from "../domain/project";

interface IdentityFieldsProps {
  idPrefix: string;
  name: string;
  idea: string;
  problem: string;
  proposedSolution: string;
  errors: ProjectFieldErrors;
  onNameChange: (value: string) => void;
  onIdeaChange: (value: string) => void;
  onProblemChange: (value: string) => void;
  onProposedSolutionChange: (value: string) => void;
}

/**
 * Shared name/idea/problem/proposed-solution fields, used both by first-creation
 * (`ProjectCreatePage`) and the always-reachable wizard `IdentityStep`, so the two never
 * duplicate validation-display logic or drift apart.
 */
export function IdentityFields({
  idPrefix,
  name,
  idea,
  problem,
  proposedSolution,
  errors,
  onNameChange,
  onIdeaChange,
  onProblemChange,
  onProposedSolutionChange,
}: IdentityFieldsProps) {
  const { t } = useTranslation();

  function errorText(code: "required" | "tooLong" | undefined): string | undefined {
    if (!code) return undefined;
    return code === "required"
      ? t("pages.projectCreate.errorRequired")
      : t("pages.projectCreate.errorTooLong");
  }

  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-text" htmlFor={`${idPrefix}-name-input`}>
        {t("pages.projectCreate.nameLabel")}
        <input
          id={`${idPrefix}-name-input`}
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          aria-invalid={Boolean(errors.name)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-text"
        />
        {errors.name && <span className="text-xs text-danger">{errorText(errors.name)}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm text-text" htmlFor={`${idPrefix}-idea-input`}>
        {t("pages.projectCreate.ideaLabel")}
        <textarea
          id={`${idPrefix}-idea-input`}
          value={idea}
          onChange={(event) => onIdeaChange(event.target.value)}
          aria-invalid={Boolean(errors.idea)}
          className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-text"
        />
        {errors.idea && <span className="text-xs text-danger">{errorText(errors.idea)}</span>}
      </label>

      <label
        className="flex flex-col gap-1 text-sm text-text"
        htmlFor={`${idPrefix}-problem-input`}
      >
        {t("pages.projectCreate.problemLabel")}
        <textarea
          id={`${idPrefix}-problem-input`}
          value={problem}
          onChange={(event) => onProblemChange(event.target.value)}
          aria-invalid={Boolean(errors.problem)}
          className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-text"
        />
        {errors.problem && <span className="text-xs text-danger">{errorText(errors.problem)}</span>}
      </label>

      <label
        className="flex flex-col gap-1 text-sm text-text"
        htmlFor={`${idPrefix}-solution-input`}
      >
        {t("pages.projectCreate.solutionLabel")}
        <textarea
          id={`${idPrefix}-solution-input`}
          value={proposedSolution}
          onChange={(event) => onProposedSolutionChange(event.target.value)}
          aria-invalid={Boolean(errors.proposedSolution)}
          className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-text"
        />
        {errors.proposedSolution && (
          <span className="text-xs text-danger">{errorText(errors.proposedSolution)}</span>
        )}
      </label>
    </>
  );
}
