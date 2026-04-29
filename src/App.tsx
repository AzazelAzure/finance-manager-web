import { Navigate, Route, Routes } from "react-router-dom";
import { CookieBanner } from "./components/CookieBanner";
import { PublicShell } from "./layout/PublicShell";
import { ProtectedShell } from "./layout/ProtectedShell";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { PhasePlaceholderPage } from "./pages/PhasePlaceholderPage";
import { SignupPage } from "./pages/SignupPage";
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
      <CookieBanner />
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
              element={
                <PhasePlaceholderPage
                  title="Transactions"
                  blurb="Quick entry, filters, and CRUD are implemented in a later task."
                  showDashboardDrillHint
                />
              }
            />
            <Route
              path="transactions/new"
              element={
                <PhasePlaceholderPage
                  title="New transaction"
                  blurb="The transaction editor modal ships in the transactions workstream. Link opened from the dashboard with ?type=."
                />
              }
            />
            <Route
              path="transactions/calendar"
              element={
                <PhasePlaceholderPage
                  title="Transaction calendar"
                  blurb="Calendar and heat map views ship in a later task."
                />
              }
            />
            <Route
              path="transactions/deep-dive"
              element={
                <PhasePlaceholderPage
                  title="Transaction insights"
                  blurb="Flow and category deep-dive ships in a later task."
                />
              }
            />
            <Route
              path="upcoming-expenses"
              element={
                <PhasePlaceholderPage title="Upcoming expenses" blurb="Bills pipeline comes in a later task." />
              }
            />
            <Route
              path="upcoming-expenses/deep-dive"
              element={
                <PhasePlaceholderPage title="Bills insights" blurb="Bills deep-dive ships in a later task." />
              }
            />
            <Route
              path="data"
              element={
                <PhasePlaceholderPage
                  title="Data hub"
                  blurb="Sources, categories, and tags management ships in a later task."
                />
              }
            />
            <Route
              path="settings/profile"
              element={
                <PhasePlaceholderPage title="Profile and settings" blurb="Settings tabs ship in a later task." />
              }
            />
            <Route
              path="onboarding"
              element={<PhasePlaceholderPage title="Onboarding" blurb="First-run walkthrough ships in a later task." />}
            />
            <Route
              path="onboarding/sources"
              element={
                <PhasePlaceholderPage
                  title="Onboarding: sources"
                  blurb="First source setup is implemented in a later task."
                />
              }
            />
            <Route
              path="onboarding/categories"
              element={
                <PhasePlaceholderPage
                  title="Onboarding: categories"
                  blurb="Category step ships in a later task."
                />
              }
            />
            <Route
              path="onboarding/review"
              element={
                <PhasePlaceholderPage title="Onboarding: review" blurb="Review and finish step ships in a later task." />
              }
            />
            <Route index element={<Navigate to="/app/dashboard" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<WildcardRedirect />} />
      </Routes>
    </div>
  );
}
