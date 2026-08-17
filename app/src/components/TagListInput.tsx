import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

interface TagListInputProps {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  helpText?: string;
}

/** Reusable chip/tag input for the many free-text array fields (targetPlatforms, dataSensitivity, enabledCapabilities, forbiddenTechnologies, brief lists — FR-013). */
export function TagListInput({
  id,
  label,
  values,
  onChange,
  placeholder,
  helpText,
}: TagListInputProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  function commitDraft(): void {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    setDraft("");
    if (values.includes(trimmed)) return;
    onChange([...values, trimmed]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && draft.length === 0 && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  function removeValue(value: string): void {
    onChange(values.filter((existing) => existing !== value));
  }

  return (
    <div className="flex flex-col gap-1 text-sm text-text">
      <label htmlFor={id}>{label}</label>
      {helpText && <span className="text-xs text-muted">{helpText}</span>}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-2 py-2">
        {values.map((value) => (
          <span
            key={value}
            className="flex items-center gap-1 rounded-full bg-background px-3 py-1 text-xs text-text"
          >
            {value}
            <button
              type="button"
              onClick={() => removeValue(value)}
              aria-label={t("common.removeTag", { value })}
              className="leading-none text-muted hover:text-danger"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={placeholder}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-text outline-none"
        />
      </div>
    </div>
  );
}
