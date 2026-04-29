import {
  BookOpen,
  Calendar,
  Database,
  LayoutDashboard,
  List,
  LogOut,
  User,
  Wallet,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../state/SessionContext";
import type { ReactNode } from "react";

const PRIMARY_NAV: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}> = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/transactions", label: "Transactions", icon: List },
  { to: "/app/transactions/calendar", label: "Calendar", icon: Calendar },
  { to: "/app/upcoming-expenses", label: "Upcoming", icon: Wallet },
  { to: "/app/data", label: "Data", icon: Database },
  { to: "/app/settings/profile", label: "Profile", icon: User },
];

const TITLE: Record<string, string> = {
  "/app/dashboard": "Dashboard",
  "/app/transactions": "Transactions",
  "/app/transactions/calendar": "Calendar",
  "/app/transactions/deep-dive": "Transaction insights",
  "/app/upcoming-expenses": "Upcoming expenses",
  "/app/upcoming-expenses/deep-dive": "Bills — insights",
  "/app/data": "Data hub",
  "/app/settings/profile": "Settings",
  "/app/onboarding": "Onboarding",
  "/app/onboarding/sources": "Onboarding",
  "/app/onboarding/categories": "Onboarding",
  "/app/onboarding/review": "Onboarding",
};

function NavItem({
  to,
  label,
  end,
  icon: Icon,
}: {
  to: string;
  label: string;
  end?: boolean;
  icon: typeof LayoutDashboard;
}): ReactNode {
  return (
    <NavLink
      to={to}
      className="shell-nav-link"
      end={end}
    >
      <Icon size={20} strokeWidth={2} aria-hidden focusable="false" />
      <span style={{ whiteSpace: "nowrap" }}>{label}</span>
    </NavLink>
  );
}

function MobileNavItem({
  to,
  label,
  end,
  icon: Icon,
}: {
  to: string;
  label: string;
  end?: boolean;
  icon: typeof LayoutDashboard;
}): ReactNode {
  return (
    <NavLink
      to={to}
      className="shell-nav-link"
      end={end}
      style={{ minWidth: "2.5rem" }}
    >
      <Icon size={20} strokeWidth={2} aria-hidden focusable="false" />
      <span className="sr-only">{label}</span>
    </NavLink>
  );
}

export function ProtectedShell(): ReactNode {
  const loc = useLocation();
  const navigate = useNavigate();
  const { logout } = useSession();
  const title = TITLE[loc.pathname] ?? "App";

  function onLogout(): void {
    logout();
    navigate("/");
  }

  return (
    <div className="protected-root">
      <aside className="protected-sidebar" aria-label="Main navigation (desktop)">
        <div className="protected-side-nav">
          {PRIMARY_NAV.map((n) => (
            <NavItem key={n.to} to={n.to} label={n.label} end={n.end} icon={n.icon} />
          ))}
        </div>
        <div className="protected-bottom-bar">
          <a
            href="https://github.com/AzazelAzure/finance-manager"
            className="shell-nav-link"
            rel="noreferrer"
            target="_blank"
            style={{ display: "flex" }}
          >
            <BookOpen size={20} />
            <span>Guide</span>
          </a>
          <button className="shell-nav-link" type="button" onClick={onLogout} style={{ width: "100%" }}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      <div className="protected-content-wrap">
        <header className="protected-sticky-top">
          <h1 id="app-page-title">{title}</h1>
          <span className="muted" title="Locale selector in a later task">
            EN
          </span>
        </header>
        <main className="protected-main-inner" aria-labelledby="app-page-title">
          <Outlet />
        </main>
        <nav className="protected-top-strip" aria-label="Main navigation (mobile)">
          {PRIMARY_NAV.map((n) => (
            <MobileNavItem key={n.to} to={n.to} label={n.label} end={n.end} icon={n.icon} />
          ))}
          <button
            type="button"
            className="shell-nav-link"
            onClick={onLogout}
            aria-label="Log out"
            style={{ minWidth: "2.5rem" }}
          >
            <LogOut size={20} />
            <span className="sr-only">Log out</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
