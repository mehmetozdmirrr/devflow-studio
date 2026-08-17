import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Project } from "@contracts/project";

import { useProjectsStore } from "../../../application/projectsStore";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import {
  SYSTEM_DOMAINS,
  createCustomDomainId,
  validateCustomDomainLabel,
} from "../../../domain/domains";
import { applyDomainRemoval, computeDomainRemovalImpact } from "../../../domain/wizardSteps";

interface DomainsStepProps {
  project: Project;
}

/** FR-011/012: multi-domain + custom domain selection. Removal always goes through an explicit impact-confirm dialog (AC-009) — never a silent clear. */
export function DomainsStep({ project }: DomainsStepProps) {
  const { t, i18n } = useTranslation();
  const updateProjectDraft = useProjectsStore((state) => state.updateProjectDraft);
  const [customLabel, setCustomLabel] = useState("");
  const [customError, setCustomError] = useState<"required" | undefined>(undefined);
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);

  const locale = i18n.language === "tr" ? "tr" : "en";
  const { domainIds, customDomainIds, customDomainLabels } = project.configuration;
  const selectedSystemIds = new Set(domainIds);

  function requestRemoveSystemDomain(domainId: string): void {
    setPendingRemovalId(domainId);
  }

  function addSystemDomain(domainId: string): void {
    updateProjectDraft(project.id, { configuration: { domainIds: [...domainIds, domainId] } });
  }

  function handleAddCustomDomain(): void {
    const error = validateCustomDomainLabel(customLabel);
    if (error) {
      setCustomError(error);
      return;
    }
    const id = createCustomDomainId(customLabel, [...domainIds, ...customDomainIds]);
    updateProjectDraft(project.id, {
      configuration: {
        customDomainIds: [...customDomainIds, id],
        customDomainLabels: { ...customDomainLabels, [id]: customLabel.trim() },
      },
    });
    setCustomLabel("");
    setCustomError(undefined);
  }

  function handleConfirmRemoval(): void {
    if (!pendingRemovalId) return;
    updateProjectDraft(project.id, {
      configuration: applyDomainRemoval(project.configuration, pendingRemovalId),
    });
    setPendingRemovalId(null);
  }

  const remainingDomainIds = pendingRemovalId
    ? [...domainIds, ...customDomainIds].filter((id) => id !== pendingRemovalId)
    : [];
  const pendingImpact = pendingRemovalId
    ? computeDomainRemovalImpact(
        pendingRemovalId,
        remainingDomainIds,
        project.configuration.enabledCapabilities,
      )
    : null;
  const pendingLabel = pendingRemovalId
    ? (customDomainLabels[pendingRemovalId] ??
      SYSTEM_DOMAINS.find((domain) => domain.id === pendingRemovalId)?.name[locale] ??
      pendingRemovalId)
    : "";

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">{t("wizard.domains.description")}</p>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-text">
          {t("wizard.domains.systemHeading")}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SYSTEM_DOMAINS.map((domain) => {
            const isSelected = selectedSystemIds.has(domain.id);
            return (
              <label
                key={domain.id}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() =>
                    isSelected ? requestRemoveSystemDomain(domain.id) : addSystemDomain(domain.id)
                  }
                />
                {domain.name[locale]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-text">
          {t("wizard.domains.customHeading")}
        </legend>
        {customDomainIds.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {customDomainIds.map((id) => (
              <li
                key={id}
                className="flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs text-text"
              >
                {customDomainLabels[id] ?? id}
                <button
                  type="button"
                  onClick={() => setPendingRemovalId(id)}
                  aria-label={t("wizard.domains.removeCustom", {
                    label: customDomainLabels[id] ?? id,
                  })}
                  className="text-muted hover:text-danger"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="wizard-custom-domain-input">
            {t("wizard.domains.customLabelInput")}
          </label>
          <input
            id="wizard-custom-domain-input"
            type="text"
            value={customLabel}
            onChange={(event) => {
              setCustomLabel(event.target.value);
              setCustomError(undefined);
            }}
            placeholder={t("wizard.domains.customLabelPlaceholder")}
            aria-invalid={Boolean(customError)}
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-text"
          />
          <button
            type="button"
            onClick={handleAddCustomDomain}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-text hover:bg-surface"
          >
            {t("wizard.domains.addCustomAction")}
          </button>
        </div>
        {customError && (
          <span className="text-xs text-danger">{t("pages.projectCreate.errorRequired")}</span>
        )}
      </fieldset>

      {domainIds.length === 0 && customDomainIds.length === 0 && (
        <p className="text-sm text-danger">{t("wizard.domains.emptyError")}</p>
      )}

      <ConfirmDialog
        open={pendingRemovalId !== null}
        title={t("wizard.domains.removeConfirmTitle", { label: pendingLabel })}
        body={
          pendingImpact && pendingImpact.clearedCapabilities.length > 0
            ? t("wizard.domains.removeConfirmBodyWithImpact", {
                list: pendingImpact.clearedCapabilities.join(", "),
              })
            : t("wizard.domains.removeConfirmBody")
        }
        confirmLabel={t("wizard.domains.removeConfirmAction")}
        destructive
        onConfirm={handleConfirmRemoval}
        onCancel={() => setPendingRemovalId(null)}
      />
    </div>
  );
}
