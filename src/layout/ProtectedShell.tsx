import {
  BookOpen,
  Calendar,
  Database,
  LayoutDashboard,
  List,
  LogOut,
  PlayCircle,
  User,
  Wallet,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { setLocale, tr, trFmt, useLocale } from "../lib/i18n";
import { OnboardingSandbox } from "../components/tours/OnboardingSandbox";
import { useTour } from "../components/tours/TourProvider";
import { useSession } from "../state/SessionContext";
import { useState, type ReactNode } from "react";
import { useHelpMode } from "../components/tours/TourProvider";
import { OfflineHistoryBanner } from "../components/OfflineHistoryBanner";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { discardOutboxAndClear, drainOutbox } from "../offline/drain";
import { outboxDepth } from "../offline/outbox";
import { SyncIndicator } from "../components/SyncIndicator";

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
  const { isHelpModeActive, toggleHelpMode } = useHelpMode();
  const { hasCompletedGlobalTour } = useTour();

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [replaySandbox, setReplaySandbox] = useState(false);
  const showSandbox = !hasCompletedGlobalTour() || replaySandbox;
  const [logoutOutboxStep, setLogoutOutboxStep] = useState(false);
  const [logoutOutboxCount, setLogoutOutboxCount] = useState(0);
  const title = tr(TITLE[loc.pathname] ?? "shell.title.app", locale);

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
          <button type="button" className={`shell-nav-link ${isHelpModeActive ? "shell-nav-link--active" : ""}`} onClick={toggleHelpMode}>
            <BookOpen size={20} className="shell-nav-icon" />
            <span className="shell-nav-label">{tr("shell.nav.guide", locale)}</span>
          </button>
          <button type="button" className="shell-nav-link" onClick={() => setReplaySandbox(true)}>
            <PlayCircle size={20} className="shell-nav-icon" />
            <span className="shell-nav-label">Replay Tour</span>
          </button>
          <button
            className="shell-nav-link shell-nav-link--danger"
            type="button"
            onClick={() => {
              setLogoutOutboxStep(false);
              setLogoutOutboxCount(0);
              setLogoutOpen(true);
            }}
          >
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
            <SyncIndicator />
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
        <OfflineHistoryBanner />
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
            className={`shell-nav-link ${isHelpModeActive ? "shell-nav-link--active" : ""}`}
            onClick={toggleHelpMode}
            aria-label={tr("shell.nav.guide", locale)}
          >
            <BookOpen size={20} />
            <span className="sr-only">{tr("shell.nav.guide", locale)}</span>
          </button>
          <button
            type="button"
            className="shell-nav-link shell-nav-link--danger"
            onClick={() => {
              setLogoutOutboxStep(false);
              setLogoutOutboxCount(0);
              setLogoutOpen(true);
            }}
            aria-label={tr("shell.nav.logout", locale)}
          >
            <LogOut size={20} />
            <span className="sr-only">{tr("shell.nav.logout", locale)}</span>
          </button>
        </nav>
      </div>
      <Modal
        open={logoutOpen}
        onClose={() => {
          setLogoutOpen(false);
          setLogoutOutboxStep(false);
          setLogoutOutboxCount(0);
        }}
        title={tr("shell.nav.logout", locale)}
      >
        <div className="stack" style={{ marginTop: 12 }}>
          {!logoutOutboxStep ? (
            <>
              <p className="muted-text" style={{ margin: 0 }}>
                {tr("shell.logout.confirm", locale)}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setLogoutOpen(false);
                    setLogoutOutboxStep(false);
                    setLogoutOutboxCount(0);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      const depth = await outboxDepth();
                      if (depth > 0) {
                        setLogoutOutboxCount(depth);
                        setLogoutOutboxStep(true);
                        return;
                      }
                      setLogoutOpen(false);
                      setLogoutOutboxStep(false);
                      onLogout();
                    })();
                  }}
                >
                  {tr("shell.nav.logout", locale)}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="muted-text" style={{ margin: 0 }}>
                {logoutOutboxCount > 0
                  ? trFmt("shell.logout.outboxPromptDepth", locale, { count: logoutOutboxCount })
                  : tr("shell.logout.outboxPrompt", locale)}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setLogoutOutboxStep(false);
                  }}
                >
                  {tr("shell.logout.back", locale)}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void (async () => {
                      await drainOutbox();
                      const depth = await outboxDepth();
                      if (depth === 0) {
                        setLogoutOpen(false);
                        setLogoutOutboxStep(false);
                        onLogout();
                      }
                    })();
                  }}
                >
                  {tr("shell.logout.syncNow", locale)}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void (async () => {
                      await discardOutboxAndClear();
                      setLogoutOpen(false);
                      setLogoutOutboxStep(false);
                      onLogout();
                    })();
                  }}
                >
                  {tr("shell.logout.discard", locale)}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
      {showSandbox && <OnboardingSandbox onDismiss={() => setReplaySandbox(false)} />}
    </div>
  );
}
