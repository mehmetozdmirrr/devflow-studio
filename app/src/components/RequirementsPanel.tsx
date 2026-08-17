import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Requirement, RequirementPriority, RequirementType } from "@contracts/requirement";

import {
  addRequirement,
  hasRequirementFieldErrors,
  removeRequirement,
  reprioritizeRequirement,
  sortRequirementsByPriority,
  updateRequirement,
  validateRequirementInput,
  type RequirementFieldErrors,
} from "../domain/requirements";
import { ConfirmDialog } from "./ConfirmDialog";
import { Button } from "./ui/Button";

interface RequirementsPanelProps {
  idPrefix: string;
  requirements: Requirement[];
  allowedTypes: RequirementType[];
  onChange: (requirements: Requirement[]) => void;
}

const PRIORITIES: RequirementPriority[] = ["must", "should", "could", "wont"];

function fieldErrorText(
  t: (key: string) => string,
  code: "required" | "tooLong" | undefined,
): string | undefined {
  if (!code) return undefined;
  return code === "required"
    ? t("pages.projectCreate.errorRequired")
    : t("pages.projectCreate.errorTooLong");
}

/** Full requirements CRUD (FR-014), filtered to `allowedTypes` for display/add but operating on — and always writing back — the project's whole `requirements` list so other steps' entries are never dropped. */
export function RequirementsPanel({
  idPrefix,
  requirements,
  allowedTypes,
  onChange,
}: RequirementsPanelProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<RequirementType>(allowedTypes[0]);
  const [priority, setPriority] = useState<RequirementPriority>("should");
  const [errors, setErrors] = useState<RequirementFieldErrors>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  const visible = sortRequirementsByPriority(
    requirements.filter((requirement) => allowedTypes.includes(requirement.type)),
  );

  function resetForm(): void {
    setTitle("");
    setDescription("");
    setType(allowedTypes[0]);
    setPriority("should");
    setErrors({});
    setEditingId(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const input = { type, title, description, priority };
    const fieldErrors = validateRequirementInput(input);
    if (hasRequirementFieldErrors(fieldErrors)) {
      setErrors(fieldErrors);
      return;
    }
    onChange(
      editingId
        ? updateRequirement(requirements, editingId, input)
        : addRequirement(requirements, input),
    );
    resetForm();
  }

  function handleEdit(requirement: Requirement): void {
    setEditingId(requirement.id);
    setTitle(requirement.title);
    setDescription(requirement.description);
    setType(requirement.type);
    setPriority(requirement.priority);
    setErrors({});
  }

  function handleRemoveConfirmed(): void {
    if (!pendingRemoveId) return;
    onChange(removeRequirement(requirements, pendingRemoveId));
    if (editingId === pendingRemoveId) resetForm();
    setPendingRemoveId(null);
  }

  function handlePriorityChange(id: string, nextPriority: RequirementPriority): void {
    onChange(reprioritizeRequirement(requirements, id, nextPriority));
  }

  const pendingRemoveTitle =
    requirements.find((requirement) => requirement.id === pendingRemoveId)?.title ?? "";

  return (
    <div className="flex flex-col gap-4">
      {visible.length === 0 ? (
        <p className="text-sm text-muted">{t("wizard.requirements.emptyBody")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((requirement) => (
            <li
              key={requirement.id}
              className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <p className="font-medium text-text">{requirement.title}</p>
                <p className="text-sm text-muted">{requirement.description}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`${idPrefix}-priority-${requirement.id}`}>
                  {t("wizard.requirements.priorityLabel")}
                </label>
                <select
                  id={`${idPrefix}-priority-${requirement.id}`}
                  value={requirement.priority}
                  onChange={(event) =>
                    handlePriorityChange(requirement.id, event.target.value as RequirementPriority)
                  }
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-text"
                >
                  {PRIORITIES.map((priorityOption) => (
                    <option key={priorityOption} value={priorityOption}>
                      {t(`wizard.requirements.priority.${priorityOption}`)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleEdit(requirement)}
                  className="rounded-md border border-border px-2 py-1 text-xs text-text hover:bg-background"
                >
                  {t("wizard.requirements.editAction")}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingRemoveId(requirement.id)}
                  className="rounded-md border border-danger px-2 py-1 text-xs text-danger hover:bg-danger/10"
                >
                  {t("wizard.requirements.removeAction")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3"
      >
        <h3 className="text-sm font-semibold text-text">
          {editingId ? t("wizard.requirements.editHeading") : t("wizard.requirements.addHeading")}
        </h3>

        <label
          className="flex flex-col gap-1 text-sm text-text"
          htmlFor={`${idPrefix}-title-input`}
        >
          {t("wizard.requirements.titleLabel")}
          <input
            id={`${idPrefix}-title-input`}
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-invalid={Boolean(errors.title)}
            className="rounded-md border border-border bg-background px-3 py-2 text-text"
          />
          {errors.title && (
            <span className="text-xs text-danger">{fieldErrorText(t, errors.title)}</span>
          )}
        </label>

        <label
          className="flex flex-col gap-1 text-sm text-text"
          htmlFor={`${idPrefix}-description-input`}
        >
          {t("wizard.requirements.descriptionLabel")}
          <textarea
            id={`${idPrefix}-description-input`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={Boolean(errors.description)}
            className="min-h-16 rounded-md border border-border bg-background px-3 py-2 text-text"
          />
          {errors.description && (
            <span className="text-xs text-danger">{fieldErrorText(t, errors.description)}</span>
          )}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          {allowedTypes.length > 1 && (
            <label
              className="flex flex-col gap-1 text-sm text-text"
              htmlFor={`${idPrefix}-type-select`}
            >
              {t("wizard.requirements.typeLabel")}
              <select
                id={`${idPrefix}-type-select`}
                value={type}
                onChange={(event) => setType(event.target.value as RequirementType)}
                className="rounded-md border border-border bg-background px-3 py-2 text-text"
              >
                {allowedTypes.map((typeOption) => (
                  <option key={typeOption} value={typeOption}>
                    {t(`wizard.requirements.type.${typeOption}`)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label
            className="flex flex-col gap-1 text-sm text-text"
            htmlFor={`${idPrefix}-priority-select`}
          >
            {t("wizard.requirements.priorityLabel")}
            <select
              id={`${idPrefix}-priority-select`}
              value={priority}
              onChange={(event) => setPriority(event.target.value as RequirementPriority)}
              className="rounded-md border border-border bg-background px-3 py-2 text-text"
            >
              {PRIORITIES.map((priorityOption) => (
                <option key={priorityOption} value={priorityOption}>
                  {t(`wizard.requirements.priority.${priorityOption}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-3">
          <Button type="submit" variant="primary">
            {editingId ? t("wizard.requirements.saveAction") : t("wizard.requirements.addAction")}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              {t("common.cancel")}
            </Button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={pendingRemoveId !== null}
        title={t("wizard.requirements.removeConfirmTitle", { title: pendingRemoveTitle })}
        body={t("wizard.requirements.removeConfirmBody")}
        confirmLabel={t("wizard.requirements.removeAction")}
        destructive
        onConfirm={handleRemoveConfirmed}
        onCancel={() => setPendingRemoveId(null)}
      />
    </div>
  );
}
