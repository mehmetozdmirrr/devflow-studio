import type { ReactNode } from "react";

import { SiteHeader } from "./SiteHeader";

interface MarketingShellProps {
  children: ReactNode;
}

/** Landing/marketing surface: same global header as the workspace, but full-bleed main content — each landing section manages its own width, instead of being forced into the app's max-w-6xl workspace column. */
export function MarketingShell({ children }: MarketingShellProps) {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex flex-col focus:outline-none">
        {children}
      </main>
    </>
  );
}
