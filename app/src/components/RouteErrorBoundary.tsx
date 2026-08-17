import { isRouteErrorResponse, useRouteError } from "react-router";
import { ErrorState } from "./ErrorState";
import { NotFoundPage } from "../pages/NotFoundPage";

export function RouteErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />;
  }

  console.error("Unhandled route error", error);
  return <ErrorState onRetry={() => window.location.reload()} />;
}
