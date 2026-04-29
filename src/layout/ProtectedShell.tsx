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
import { setLocale, tr, useLocale } from "../lib/i18n";
import { useSession } from "../state/SessionContext";
import { useMemo, useState, type ReactNode } from "react";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";

const PRIMARY_NAV: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}> = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/transactions", label: "Transactions", icon: List, end: true },
  { to: "/app/transactions/calendar", label: "Calendar", icon: Calendar, end: true },
  { to: "/app/upcoming-expenses", label: "Upcoming", icon: Wallet },
  { to: "/app/data", label: "Data", icon: Database },
  { to: "/app/settings/profile", label: "Profile", icon: User },
];

const TITLE: Record<string, string> = {
  "/app/dashboard": "shell.title.dashboard",
  "/app/transactions": "shell.title.transactions",
  "/app/transactions/calendar": "shell.title.calendar",
  "/app/transactions/deep-dive": "shell.title.txInsights",
  "/app/upcoming-expenses": "shell.title.upcoming",
  "/app/upcoming-expenses/deep-dive": "shell.title.billsInsights",
  "/app/data": "shell.title.dataHub",
  "/app/settings/profile": "shell.title.settings",
  "/app/onboarding": "shell.title.onboarding",
  "/app/onboarding/sources": "shell.title.onboarding",
  "/app/onboarding/categories": "shell.title.onboarding",
  "/app/onboarding/review": "shell.title.onboarding",
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
      <Icon size={20} strokeWidth={2} aria-hidden focusable="false" className="shell-nav-icon" />
      <span className="shell-nav-label">{label}</span>
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
  const locale = useLocale();
  const loc = useLocation();
  const navigate = useNavigate();
  const { logout } = useSession();
  const [guideOpen, setGuideOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const title = tr(TITLE[loc.pathname] ?? "shell.title.app", locale);
  const guideSteps = useMemo(() => {
    if (loc.pathname.startsWith("/app/dashboard")) {
      return [
        "Use KPI cards to spot period trends quickly.",
        "Apply filters first, then refresh to compare snapshots.",
        "Quick add supports income, expense, transfer, and bill flows.",
        "Chart slices drill to detailed transactions.",
      ];
    }
    if (loc.pathname.startsWith("/app/transactions/calendar")) {
      return [
        "Use month arrows to switch periods.",
        "Click a day to inspect transactions and due expenses.",
        "Heat intensity increases with spending magnitude.",
        "Use display/metric controls to compare views.",
      ];
    }
    if (loc.pathname.startsWith("/app/transactions")) {
      return [
        "Filter by period/type/source and apply to reload results.",
        "Use Add transaction or Add transfer for proper payloads.",
        "Edit and delete actions are in-line per row.",
      ];
    }
    if (loc.pathname.startsWith("/app/upcoming-expenses")) {
      return [
        "Track due expenses and recurring bills by date window.",
        "Use status and recurrence filters to focus follow-up work.",
        "Deep dive view gives timeline and KPI summaries.",
      ];
    }
    if (loc.pathname.startsWith("/app/data")) {
      return [
        "Manage Sources, Categories, and Tags from one page.",
        "Keep names consistent to improve dashboard filters and charts.",
        "Source currency/amount updates affect downstream displays.",
      ];
    }
    return [
      "Use the left nav icons to switch between app surfaces.",
      "Locale chips in the header switch EN/TL language instantly.",
      "Use Guide on any page to see context-specific tips.",
    ];
  }, [loc.pathname]);

  function onLogout(): void {
    logout();
    navigate("/");
  }

  return (
    <div className="protected-root">
      <aside className="protected-sidebar" aria-label="Main navigation (desktop)">
        <div className="protected-brand" aria-hidden>
          <span className="protected-brand__mark" />
          <span className="protected-brand__text">Hive</span>
        </div>
        <div className="protected-side-nav">
          {PRIMARY_NAV.map((n) => (
            <NavItem key={n.to} to={n.to} label={tr(`shell.nav.${n.label.toLowerCase()}`, locale)} end={n.end} icon={n.icon} />
          ))}
        </div>
        <div className="protected-bottom-bar">
          <button type="button" className="shell-nav-link" onClick={() => setGuideOpen(true)}>
            <BookOpen size={20} className="shell-nav-icon" />
            <span className="shell-nav-label">{tr("shell.nav.guide", locale)}</span>
          </button>
          <button className="shell-nav-link shell-nav-link--danger" type="button" onClick={() => setLogoutOpen(true)}>
            <LogOut size={20} className="shell-nav-icon" />
            <span className="shell-nav-label">{tr("shell.nav.logout", locale)}</span>
          </button>
        </div>
      </aside>
      <div className="protected-content-wrap">
        <header className="protected-sticky-top">
          <div className="protected-sticky-top__title-wrap">
            <h1 id="app-page-title">{title}</h1>
            <span className="protected-sticky-top__subtitle">{tr("shell.subtitle", locale)}</span>
          </div>
          <div className="protected-header-actions">
            <button
              type="button"
              className="protected-locale-chip"
              aria-pressed={locale === "en-US"}
              onClick={() => setLocale("en-US")}
              title={tr("locale.aria", locale)}
            >
              🇺🇸 EN
            </button>
            <button
              type="button"
              className="protected-locale-chip"
              aria-pressed={locale === "tl-PH"}
              onClick={() => setLocale("tl-PH")}
              title={tr("locale.aria", locale)}
            >
              🇵🇭 TL
            </button>
          </div>
        </header>
        <main className="protected-main-inner" aria-labelledby="app-page-title">
          <Outlet />
        </main>
        <nav className="protected-top-strip" aria-label="Main navigation (mobile)">
          {PRIMARY_NAV.map((n) => (
            <MobileNavItem
              key={n.to}
              to={n.to}
              label={tr(`shell.nav.${n.label.toLowerCase()}`, locale)}
              end={n.end}
              icon={n.icon}
            />
          ))}
          <button
            type="button"
            className="shell-nav-link shell-nav-link--danger"
            onClick={() => setLogoutOpen(true)}
            aria-label={tr("shell.nav.logout", locale)}
          >
            <LogOut size={20} />
            <span className="sr-only">{tr("shell.nav.logout", locale)}</span>
          </button>
        </nav>
      </div>
      <Modal open={guideOpen} onClose={() => setGuideOpen(false)} title={`${tr("shell.nav.guide", locale)} - ${title}`}>
        <div className="stack" style={{ marginTop: 12 }}>
          {guideSteps.map((step, idx) => (
            <p key={step} className="muted-text" style={{ margin: 0 }}>
              {idx + 1}. {step}
            </p>
          ))}
        </div>
      </Modal>
      <Modal open={logoutOpen} onClose={() => setLogoutOpen(false)} title={tr("shell.nav.logout", locale)}>
        <div className="stack" style={{ marginTop: 12 }}>
          <p className="muted-text" style={{ margin: 0 }}>
            {tr("shell.logout.confirm", locale)}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Button type="button" variant="secondary" onClick={() => setLogoutOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setLogoutOpen(false);
                onLogout();
              }}
            >
              {tr("shell.nav.logout", locale)}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
