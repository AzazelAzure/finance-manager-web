import { useSyncExternalStore, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ClientBuildUpgradeGate } from "./components/ClientBuildUpgradeGate";
import { CookieBanner } from "./components/CookieBanner";
import { SyncProgressOverlay } from "./components/SyncProgressOverlay";
import { SyncStatusBar } from "./components/SyncStatusBar";
import { isPwaStandaloneDisplay } from "./lib/pwaDisplay";
import { PublicShell } from "./layout/PublicShell";
import { ProtectedShell } from "./layout/ProtectedShell";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { TransactionsPage } from "./pages/transactions/TransactionsPage";
import { CalendarPage } from "./pages/transactions/CalendarPage";
import { DeepDivePage } from "./pages/transactions/DeepDivePage";
import { UpcomingExpensesPage } from "./pages/upcoming/UpcomingExpensesPage";
import { UpcomingDeepDivePage } from "./pages/upcoming/UpcomingDeepDivePage";
import { DataHubPage } from "./pages/data/DataHubPage";
import { SettingsProfilePage } from "./pages/settings/SettingsProfilePage";
import { OnboardingPage } from "./pages/onboarding/OnboardingPage";
import { RequireAuth } from "./routes/RequireAuth";
import { useSession } from "./state/SessionContext";
import { TourProvider } from "./components/tours/TourProvider";

function WildcardRedirect(): ReactNode {
  const { isAuthenticated } = useSession();
  return <Navigate to={isAuthenticated ? "/app/dashboard" : "/"} replace />;
}

function subscribePwaStandalone(cb: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const mq1 = window.matchMedia("(display-mode: standalone)");
  const mq2 = window.matchMedia("(display-mode: window-controls-overlay)");
  const fn = (): void => cb();
  mq1.addEventListener("change", fn);
  mq2.addEventListener("change", fn);
  return () => {
    mq1.removeEventListener("change", fn);
    mq2.removeEventListener("change", fn);
  };
}

function getPwaStandaloneSnapshot(): boolean {
  return isPwaStandaloneDisplay();
}

/**
 * Full-screen sync overlay: installed PWA only (never on marketing `/` in a browser tab).
 * Status bar: authenticated app shell in browser, or PWA anywhere.
 */
function SyncChrome(): ReactNode {
  const { pathname } = useLocation();
  const pwa = useSyncExternalStore(subscribePwaStandalone, getPwaStandaloneSnapshot, () => false);
  const inAppShell = pathname.startsWith("/app");
  if (pwa) {
    return (
      <>
        <SyncProgressOverlay />
        <SyncStatusBar />
      </>
    );
  }
  if (inAppShell) {
    return <SyncStatusBar />;
  }
  return null;
}

export default function App(): ReactNode {
  return (
    <div className="app-root">
      <SyncChrome />
      <ClientBuildUpgradeGate />
      <CookieBanner />
      <Routes>
        <Route element={<PublicShell />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/app" element={<TourProvider><ProtectedShell /></TourProvider>}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route
              path="transactions"
              element={<TransactionsPage />}
            />
            <Route path="transactions/new" element={<TransactionsPage />} />
            <Route path="transactions/calendar" element={<CalendarPage />} />
            <Route path="transactions/deep-dive" element={<DeepDivePage />} />
            <Route
              path="upcoming-expenses"
              element={<UpcomingExpensesPage />}
            />
            <Route
              path="upcoming-expenses/deep-dive"
              element={<UpcomingDeepDivePage />}
            />
            <Route path="data" element={<DataHubPage />} />
            <Route path="settings/profile" element={<SettingsProfilePage />} />
            <Route
              path="onboarding"
              element={<OnboardingPage step={1} />}
            />
            <Route
              path="onboarding/sources"
              element={<OnboardingPage step={2} />}
            />
            <Route
              path="onboarding/categories"
              element={<OnboardingPage step={3} />}
            />
            <Route
              path="onboarding/review"
              element={<OnboardingPage step={4} />}
            />
            <Route index element={<Navigate to="/app/dashboard" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<WildcardRedirect />} />
      </Routes>
    </div>
  );
}
