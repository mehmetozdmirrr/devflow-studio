import { useTranslation } from "react-i18next";

import {
  WIZARD_STEP_LABEL_KEYS,
  getDisplayIndex,
  getVisibleSteps,
  type WizardStepId,
} from "../domain/wizardSteps";

interface WizardStepRailProps {
  currentStepId: WizardStepId;
  stepStatus: Partial<Record<WizardStepId, boolean>>;
  errorStepIds?: WizardStepId[];
  onStepSelect: (stepId: WizardStepId) => void;
}

/** Renders only the currently visible/enabled steps with contiguous 1-based numbers (see domain/wizardSteps.ts) — the disabled `recommendations` slot never appears here in Phase 3. */
export function WizardStepRail({
  currentStepId,
  stepStatus,
  errorStepIds,
  onStepSelect,
}: WizardStepRailProps) {
  const { t } = useTranslation();
  const steps = getVisibleSteps();

  return (
    <nav aria-label={t("wizard.stepRailLabel")}>
      <ol className="flex flex-col gap-1">
        {steps.map((step) => {
          const displayIndex = getDisplayIndex(step.id);
          const isCurrent = step.id === currentStepId;
          const isComplete = stepStatus[step.id] === true;
          const hasError = errorStepIds?.includes(step.id) ?? false;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onStepSelect(step.id)}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex w-full items-center gap-2 rounded-md border-l-2 px-3 py-2 text-left text-sm ${
                  isCurrent
                    ? "border-l-primary-interactive bg-primary-interactive/10 font-medium text-text"
                    : "border-l-transparent text-text hover:bg-surface"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                    hasError
                      ? "border-danger bg-danger/10 text-danger"
                      : isComplete
                        ? "border-success bg-success/10 text-success"
                        : "border-border text-muted"
                  }`}
                >
                  {isComplete && !hasError ? "✓" : displayIndex}
                </span>
                <span>{t(WIZARD_STEP_LABEL_KEYS[step.id])}</span>
                {hasError && <span className="sr-only">{t("wizard.stepHasError")}</span>}
                {isComplete && !hasError && (
                  <span className="sr-only">{t("wizard.stepComplete")}</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
