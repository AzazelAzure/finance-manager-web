import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../state/SessionContext";
import type { ReactNode } from "react";

export function RequireAuth(): ReactNode {
  const { isAuthenticated } = useSession();
  const loc = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }
  return <Outlet />;
}
