import type { ReactNode } from "react";

interface WorkspaceGridProps {
  children: ReactNode;
  className?: string;
}

/** Two-column workspace composition: MainPane + optional InspectorPanel, stacking on narrow viewports. Formalizes the pattern CatalogPage and ProjectWizardPage already hand-rolled independently. */
export function WorkspaceGrid({ children, className }: WorkspaceGridProps) {
  return (
    <div className={`flex flex-col gap-6 lg:flex-row lg:items-start ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function MainPane({ children, className }: WorkspaceGridProps) {
  return <div className={`flex min-w-0 flex-1 flex-col gap-6 ${className ?? ""}`}>{children}</div>;
}

export type InspectorWidth = "sm" | "md" | "lg";

const INSPECTOR_WIDTH_CLASSES: Record<InspectorWidth, string> = {
  sm: "lg:w-64",
  md: "lg:w-80",
  lg: "lg:w-96",
};

interface InspectorPanelProps extends WorkspaceGridProps {
  width?: InspectorWidth;
  "aria-label"?: string;
}

export function InspectorPanel({
  children,
  className,
  width = "md",
  ...ariaProps
}: InspectorPanelProps) {
  return (
    <aside
      {...ariaProps}
      className={`flex w-full shrink-0 flex-col gap-4 ${INSPECTOR_WIDTH_CLASSES[width]} ${className ?? ""}`}
    >
      {children}
    </aside>
  );
}
