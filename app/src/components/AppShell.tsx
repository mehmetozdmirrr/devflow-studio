import { Outlet, useLocation } from "react-router";

import { SkipLink } from "./SkipLink";
import { MarketingShell } from "./layout/MarketingShell";
import { WorkspaceShell } from "./layout/WorkspaceShell";

/** Root layout: chooses the Marketing surface (`/` only) or the Workspace surface (every other route) around the routed page. Route table in `app/router.tsx` is unchanged — this is presentation-only branching on the current path. */
export function AppShell() {
  const location = useLocation();
  const isMarketing = location.pathname === "/";
  return (
    <div className="min-h-dvh bg-background text-text">
      <SkipLink />
      {isMarketing ? (
        <MarketingShell>
          <Outlet />
        </MarketingShell>
      ) : (
        <WorkspaceShell>
          <Outlet />
        </WorkspaceShell>
      )}
    </div>
  );
}
