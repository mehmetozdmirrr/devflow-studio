import { lazy, Suspense, type ReactNode } from "react";
import { useLocation } from "react-router";

import { SiteHeader } from "./SiteHeader";

// Lazy: `ProjectContextNav` pulls in `projectsStore` (and, transitively, `settingsStore` and the
// adapters/domain layer). `WorkspaceShell` itself is rendered eagerly by the root `AppShell`, so a
// static import here would drag that whole store graph into the main entry chunk on every route,
// undoing the route-level code splitting the lazy pages already rely on.
const ProjectContextNav = lazy(() =>
  import("./ProjectContextNav").then((m) => ({ default: m.ProjectContextNav })),
);

interface WorkspaceShellProps {
  children: ReactNode;
}

/**
 * Application/workspace surface for every route except `/`. Derives the current project id from
 * the URL path (not `useParams`, which only sees params matched by routes at/above this element —
 * `AppShell`/`WorkspaceShell` render above the nested project routes in the tree) so the
 * project-context nav can appear without changing the route table. `/projects/new` is excluded
 * explicitly since it isn't a project id.
 */
export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const projectId =
    segments[0] === "projects" && segments[1] && segments[1] !== "new" ? segments[1] : undefined;

  return (
    <>
      <SiteHeader />
      {projectId && (
        <Suspense fallback={null}>
          <ProjectContextNav projectId={projectId} />
        </Suspense>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-8 focus:outline-none"
      >
        {children}
      </main>
    </>
  );
}
