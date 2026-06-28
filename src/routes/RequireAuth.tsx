import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../state/SessionContext";
import { earliestIncompleteOnboardingPath } from "../state/onboarding";
import type { ReactNode } from "react";

export function RequireAuth(): ReactNode {
  const { isAuthenticated } = useSession();
  const loc = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }
  const onboardingPath = earliestIncompleteOnboardingPath();
  if (onboardingPath !== "/app/dashboard" && !loc.pathname.startsWith("/app/onboarding")) {
    return <Navigate to={onboardingPath} replace />;
  }
  return <Outlet />;
}
