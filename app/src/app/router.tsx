import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router";

import { AppShell } from "../components/AppShell";
import { RouteErrorBoundary } from "../components/RouteErrorBoundary";
import { LoadingState } from "../components/LoadingState";
import { LandingPage } from "../pages/LandingPage";
import { NotFoundPage } from "../pages/NotFoundPage";

const ProjectsPage = lazy(() =>
  import("../pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage })),
);
const ProjectCreatePage = lazy(() =>
  import("../pages/ProjectCreatePage").then((m) => ({ default: m.ProjectCreatePage })),
);
const ProjectOverviewPage = lazy(() =>
  import("../pages/ProjectOverviewPage").then((m) => ({ default: m.ProjectOverviewPage })),
);
const ProjectWizardPage = lazy(() =>
  import("../pages/wizard/ProjectWizardPage").then((m) => ({ default: m.ProjectWizardPage })),
);
const PackagePreviewPage = lazy(() =>
  import("../pages/PackagePreviewPage").then((m) => ({ default: m.PackagePreviewPage })),
);
const AIAnalysisPage = lazy(() =>
  import("../pages/AIAnalysisPage").then((m) => ({ default: m.AIAnalysisPage })),
);
const CatalogPage = lazy(() =>
  import("../pages/CatalogPage").then((m) => ({ default: m.CatalogPage })),
);
const ComparePage = lazy(() =>
  import("../pages/ComparePage").then((m) => ({ default: m.ComparePage })),
);
const TrashPage = lazy(() => import("../pages/TrashPage").then((m) => ({ default: m.TrashPage })));
const SettingsPage = lazy(() =>
  import("../pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

function withSuspense(element: ReactNode): ReactNode {
  return <Suspense fallback={<LoadingState />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "projects", element: withSuspense(<ProjectsPage />) },
      { path: "projects/new", element: withSuspense(<ProjectCreatePage />) },
      {
        path: "projects/:projectId/wizard/:stepId",
        element: withSuspense(<ProjectWizardPage />),
      },
      { path: "projects/:projectId/package", element: withSuspense(<PackagePreviewPage />) },
      { path: "projects/:projectId/ai", element: withSuspense(<AIAnalysisPage />) },
      { path: "projects/:projectId/*", element: withSuspense(<ProjectOverviewPage />) },
      { path: "catalog", element: withSuspense(<CatalogPage />) },
      { path: "compare", element: withSuspense(<ComparePage />) },
      { path: "trash", element: withSuspense(<TrashPage />) },
      { path: "settings", element: withSuspense(<SettingsPage />) },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
