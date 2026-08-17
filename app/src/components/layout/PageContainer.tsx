import type { ReactNode } from "react";

export type ContainerWidth = "default" | "narrow";

const WIDTH_CLASSES: Record<ContainerWidth, string> = {
  default: "max-w-6xl",
  narrow: "max-w-2xl",
};

interface PageContainerProps {
  width?: ContainerWidth;
  className?: string;
  children: ReactNode;
}

/** Opt-in width variant for pages that need something other than the WorkspaceShell's default max-w-6xl (e.g. a narrow form). */
export function PageContainer({ width = "default", className, children }: PageContainerProps) {
  return <div className={`w-full ${WIDTH_CLASSES[width]} ${className ?? ""}`}>{children}</div>;
}
