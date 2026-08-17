import type { ReactNode } from "react";

interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  headingId?: string;
  children: ReactNode;
  className?: string;
}

/** Shared bordered/surface section wrapper — consolidates the repeated `rounded-lg border border-border bg-surface p-4` group pattern. */
export function SectionCard({
  title,
  description,
  actions,
  headingId,
  children,
  className,
}: SectionCardProps) {
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={`flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 ${className ?? ""}`}
    >
      {(title ?? actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            {title && (
              <h2 id={headingId} className="text-lg font-semibold text-text">
                {title}
              </h2>
            )}
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
