import { useEffect } from "react";
import { RouterProvider } from "react-router";

import { router } from "./router";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { LoadingState } from "../components/LoadingState";
import { ThemeSync } from "../components/ThemeSync";
import { useSettingsStore } from "../application/settingsStore";

export function App() {
  const hydrate = useSettingsStore((state) => state.hydrate);
  const hydrated = useSettingsStore((state) => state.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <LoadingState />;
  }

  return (
    <ErrorBoundary>
      <ThemeSync />
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
