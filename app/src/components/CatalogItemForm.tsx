import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CatalogItemKind } from "@contracts/catalog";
import type { Difficulty } from "@contracts/common";

import {
  CATALOG_ITEM_KINDS,
  type CatalogItemFieldErrors,
  type UserCatalogItemInput,
} from "../domain/catalog";
import { SYSTEM_DOMAINS } from "../domain/domains";
import { TagListInput } from "./TagListInput";
import { Button } from "./ui/Button";

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];

interface CatalogItemFormProps {
  idPrefix: string;
  initial: UserCatalogItemInput;
  errors: CatalogItemFieldErrors;
  submitLabel: string;
  onSubmit: (input: UserCatalogItemInput) => void;
  onCancel: () => void;
}

export function CatalogItemForm({
  idPrefix,
  initial,
  errors,
  submitLabel,
  onSubmit,
  onCancel,
}: CatalogItemFormProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState<UserCatalogItemInput>(initial);

  function patch(next: Partial<UserCatalogItemInput>): void {
    setInput((prev) => ({ ...prev, ...next }));
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(input);
      }}
    >
      <label className="flex flex-col gap-1 text-sm text-text" htmlFor={`${idPrefix}-name`}>
        {t("pages.catalog.form.nameLabel")}
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={input.name}
          onChange={(event) => patch({ name: event.target.value })}
          className="rounded-md border border-border bg-background px-3 py-2 text-text"
          aria-invalid={errors.name !== undefined}
        />
        {errors.name && (
          <span className="text-xs text-danger">
            {t(`pages.catalog.form.error.${errors.name}`)}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm text-text" htmlFor={`${idPrefix}-kind`}>
        {t("pages.catalog.form.kindLabel")}
        <select
          id={`${idPrefix}-kind`}
          value={input.kind}
          onChange={(event) => patch({ kind: event.target.value as CatalogItemKind })}
          className="rounded-md border border-border bg-background px-3 py-2 text-text"
        >
          {CATALOG_ITEM_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`catalog.kind.${kind}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-text" htmlFor={`${idPrefix}-difficulty`}>
        {t("pages.catalog.form.difficultyLabel")}
        <select
          id={`${idPrefix}-difficulty`}
          value={input.difficulty}
          onChange={(event) => patch({ difficulty: event.target.value as Difficulty })}
          className="rounded-md border border-border bg-background px-3 py-2 text-text"
        >
          {DIFFICULTIES.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {t(`catalog.difficulty.${difficulty}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-text" htmlFor={`${idPrefix}-short-en`}>
        {t("pages.catalog.form.shortDescriptionEnLabel")}
        <input
          id={`${idPrefix}-short-en`}
          type="text"
          value={input.shortDescriptionEn}
          onChange={(event) => patch({ shortDescriptionEn: event.target.value })}
          className="rounded-md border border-border bg-background px-3 py-2 text-text"
          aria-invalid={errors.shortDescriptionEn !== undefined}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text" htmlFor={`${idPrefix}-short-tr`}>
        {t("pages.catalog.form.shortDescriptionTrLabel")}
        <input
          id={`${idPrefix}-short-tr`}
          type="text"
          value={input.shortDescriptionTr}
          onChange={(event) => patch({ shortDescriptionTr: event.target.value })}
          className="rounded-md border border-border bg-background px-3 py-2 text-text"
          aria-invalid={errors.shortDescriptionTr !== undefined}
        />
      </label>

      <label
        className="flex flex-col gap-1 text-sm text-text"
        htmlFor={`${idPrefix}-description-en`}
      >
        {t("pages.catalog.form.descriptionEnLabel")}
        <textarea
          id={`${idPrefix}-description-en`}
          value={input.descriptionEn}
          onChange={(event) => patch({ descriptionEn: event.target.value })}
          className="min-h-20 rounded-md border border-border bg-background px-3 py-2 text-text"
          aria-invalid={errors.descriptionEn !== undefined}
        />
      </label>
      <label
        className="flex flex-col gap-1 text-sm text-text"
        htmlFor={`${idPrefix}-description-tr`}
      >
        {t("pages.catalog.form.descriptionTrLabel")}
        <textarea
          id={`${idPrefix}-description-tr`}
          value={input.descriptionTr}
          onChange={(event) => patch({ descriptionTr: event.target.value })}
          className="min-h-20 rounded-md border border-border bg-background px-3 py-2 text-text"
          aria-invalid={errors.descriptionTr !== undefined}
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-text">{t("pages.catalog.form.domainsLabel")}</legend>
        <div className="flex flex-wrap gap-3">
          {SYSTEM_DOMAINS.map((domain) => (
            <label key={domain.id} className="flex items-center gap-2 text-xs text-text">
              <input
                type="checkbox"
                checked={input.domainIds.includes(domain.id)}
                onChange={(event) =>
                  patch({
                    domainIds: event.target.checked
                      ? [...input.domainIds, domain.id]
                      : input.domainIds.filter((id) => id !== domain.id),
                  })
                }
              />
              {domain.name.en}
            </label>
          ))}
        </div>
      </fieldset>

      <TagListInput
        id={`${idPrefix}-tags`}
        label={t("pages.catalog.form.tagsLabel")}
        values={input.tags}
        onChange={(tags) => patch({ tags })}
      />
      <TagListInput
        id={`${idPrefix}-platforms`}
        label={t("pages.catalog.form.platformsLabel")}
        values={input.supportedPlatforms}
        onChange={(supportedPlatforms) => patch({ supportedPlatforms })}
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
