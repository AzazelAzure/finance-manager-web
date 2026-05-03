import { Navigate, Route, Routes } from "react-router-dom";
import { ClientBuildUpgradeGate } from "./components/ClientBuildUpgradeGate";
import { CookieBanner } from "./components/CookieBanner";
import { SwUpdateBanner } from "./components/SwUpdateBanner";
import { SyncProgressOverlay } from "./components/SyncProgressOverlay";
import { SyncStatusBar } from "./components/SyncStatusBar";
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
import type { ReactNode } from "react";

function WildcardRedirect(): ReactNode {
  const { isAuthenticated } = useSession();
  return <Navigate to={isAuthenticated ? "/app/dashboard" : "/"} replace />;
}

export default function App(): ReactNode {
  return (
    <div className="app-root">
      <SyncProgressOverlay />
      <SyncStatusBar />
      <ClientBuildUpgradeGate />
      <CookieBanner />
      <SwUpdateBanner />
      <Routes>
        <Route element={<PublicShell />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/app" element={<ProtectedShell />}>
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
