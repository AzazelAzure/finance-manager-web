import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { clearToken, getToken } from "./state/auth";

function ProtectedRoute({ children }: { children: ReactElement }) {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Hive Frontend Rebuild (JS)</h1>
        {getToken() ? (
          <button className="ghost-btn" onClick={() => { clearToken(); window.location.href = "/login"; }}>
            Logout
          </button>
        ) : null}
      </header>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={getToken() ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </main>
  );
}
