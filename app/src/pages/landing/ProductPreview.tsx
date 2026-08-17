import { useTranslation } from "react-i18next";

const WORKFLOW_STEP_KEYS = [
  "brief",
  "requirements",
  "recommendations",
  "validation",
  "package",
] as const;
const TAG_KEYS = ["localFirst", "deterministic", "optionalAI"] as const;

/**
 * Static visualization of the real DevFlow workflow (brief -> requirements -> recommendations ->
 * validation -> package) for the landing hero. Presentation only — no store access, no live data,
 * no project/technology names. `aria-hidden` because it's purely decorative — it adds no
 * information beyond what the hero headline/subtitle/CTA and the "How DevFlow works" section
 * already state in text.
 */
export function WorkflowVisual() {
  const { t } = useTranslation();
  return (
    <div
      aria-hidden="true"
      className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-lg shadow-black/10"
    >
      <ol className="flex flex-col">
        {WORKFLOW_STEP_KEYS.map((key, index) => {
          const isLast = index === WORKFLOW_STEP_KEYS.length - 1;
          return (
            <li key={key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary-text text-sm font-semibold text-primary-text">
                  {index + 1}
                </span>
                {!isLast && <span className="my-1 w-px flex-1 bg-border" />}
              </div>
              <p className={`font-medium text-text ${isLast ? "pb-0" : "pb-6"}`}>
                {t(`landing.workflow.${key}`)}
              </p>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-4">
        {TAG_KEYS.map((key) => (
          <span
            key={key}
            className="rounded-full border border-border px-2 py-0.5 text-xs text-muted"
          >
            {t(`landing.workflow.tags.${key}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
