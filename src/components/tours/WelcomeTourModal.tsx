import { useState, type ReactNode } from 'react';
import { useTour } from './TourProvider';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { Step } from 'react-joyride';

const WELCOME_TOUR_ID = 'onboarding_welcome_tour';

/**
 * Steps for the welcome tour that walks new users through the real dashboard UI.
 * Each step targets an actual element in the rendered Dashboard + ProtectedShell.
 */
const WELCOME_STEPS: Step[] = [
  // ── Welcome ──
  {
    target: '.dashboard-page',
    title: 'Welcome to Hive Financial Manager!',
    content: 'This is your financial dashboard — a real-time snapshot of your money. Everything here updates as you log transactions. Let\'s walk through each piece.',
    placement: 'center',
    skipBeacon: true,
  },

  // ── KPI Cards ──
  {
    target: '#tour-kpis',
    title: 'Your Key Numbers',
    content: 'These KPI cards summarize your period at a glance: total income, total outgoing expenses, net cash flow, assets, remaining budget, safe-to-spend, leaks, and transaction count.',
    skipBeacon: true,
  },

  // ── Leaks detail (still targets KPIs but focuses on concept) ──
  {
    target: '#tour-kpis',
    title: 'What Are "Leaks"?',
    content: 'Leaks track hidden costs in account transfers — ATM withdrawal fees, cash-out/cash-in fees, transfer charges, and similar losses that silently chip away at your balance. Minimizing leaks is one of the easiest ways to save more.',
    skipBeacon: true,
  },

  // ── Quick Actions buttons ──
  {
    target: '#tour-quick-actions',
    title: 'Quick Actions',
    content: 'These buttons let you quickly log income, expenses, or transfers without leaving the dashboard. The Transfer button handles multi-currency moves between your accounts.',
    skipBeacon: true,
  },

  // ── Filters ──
  {
    target: '#tour-filters',
    title: 'Period Filters',
    content: 'Filter by month, year, or custom date range. You can also filter by source, category, tag, or currency to slice your data exactly the way you need.',
    skipBeacon: true,
  },

  // ── Replay & Refresh buttons ──
  {
    target: '#tour-replay-btn',
    title: 'Replay Tour',
    content: 'Use this button anytime to walk through this tour again. It\'s always here on the dashboard header.',
    skipBeacon: true,
  },
  {
    target: '#tour-refresh-btn',
    title: 'Refresh Data',
    content: 'Hit Refresh to re-fetch the latest data from the server. Useful after logging new transactions to see updated charts and totals.',
    skipBeacon: true,
  },

  // ── Individual Charts ──
  {
    target: '#tour-flow-chart',
    title: 'Cash Flow Chart',
    content: 'This chart shows your income vs. expenses over time, so you can spot months where spending exceeded earnings and track your trend.',
    skipBeacon: true,
  },
  {
    target: '#tour-spend-chart',
    title: 'Daily Spending & Income',
    content: 'A day-by-day view of your spending and income. Spikes here help you identify one-off big expenses or paydays.',
    skipBeacon: true,
  },
  {
    target: '#tour-category-pie',
    title: 'Expense by Category',
    content: 'See where your money goes by category. Click any slice to drill down into the individual transactions that make up that category\'s total.',
    skipBeacon: true,
  },
  {
    target: '#tour-tag-pie',
    title: 'Spending by Tag',
    content: 'Tags are flexible labels you can attach to any transaction — like "vacation", "groceries", or "work". This chart groups tagged spending so you can track custom themes.',
    skipBeacon: true,
  },

  // ── Sidebar Totals ──
  {
    target: '#tour-source-balances',
    title: 'Source Balances',
    content: 'A quick snapshot of each account\'s current balance. Negative balances are flagged with a warning icon so you can spot overdrawn accounts instantly.',
    skipBeacon: true,
  },
  {
    target: '#tour-profile-overview',
    title: 'Profile Settings',
    content: 'Your base currency, tracked sources, and spend accounts are summarized here. Click "Edit Profile" to change your currency, add new sources, or adjust which accounts count toward spending.',
    skipBeacon: true,
  },

  // ── Recent Transactions ──
  {
    target: '#tour-recent-tx',
    title: 'Recent Transactions',
    content: 'Your most recent entries are listed here for quick review. Head to the full Transactions page for search, edit, and delete capabilities.',
    skipBeacon: true,
  },

  // ── Navigation ──
  {
    target: '.protected-side-nav',
    title: 'Navigate the App',
    content: 'Use the sidebar to access Transactions, Calendar, Upcoming Expenses, Data Hub, and your Profile Settings. Each page has its own quick guide you can trigger later. Tap the Guide (book) icon to toggle Help Mode — hover over any section for a quick tooltip.',
    placement: 'right',
    skipBeacon: true,
  },
];

interface WelcomeTourModalProps {
  /** Whether the dashboard data has loaded (we don't show the modal until data is ready). */
  dataReady: boolean;
}

/**
 * Welcome modal that appears on first visit for users who haven't completed the
 * onboarding welcome tour. Uses the TourProvider's `isTourCompleted` to check
 * against the API-persisted `completed_tours` on AppProfile.
 */
export function WelcomeTourModal({ dataReady }: WelcomeTourModalProps): ReactNode {
  const { isTourCompleted, startTour, markTourCompleted } = useTour();
  const [dismissed, setDismissed] = useState(false);

  const alreadyCompleted = isTourCompleted(WELCOME_TOUR_ID);
  const showModal = dataReady && !alreadyCompleted && !dismissed;

  function handleStartTour(): void {
    setDismissed(true);
    // Use startTour — it will fire Joyride and mark completed on finish/skip
    startTour(WELCOME_TOUR_ID, WELCOME_STEPS);
  }

  function handleSkip(): void {
    setDismissed(true);
    // Mark as completed so it doesn't show again
    markTourCompleted(WELCOME_TOUR_ID);
  }

  return (
    <Modal open={showModal} title="Welcome to Hive!" onClose={handleSkip}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
        <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--text-main)' }}>
          It looks like this is your first time here. Would you like a quick guided tour 
          of the dashboard? It only takes a minute and will help you get the most out of 
          your financial tracking.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button type="button" variant="secondary" onClick={handleSkip}>
            Skip for now
          </Button>
          <Button type="button" variant="primary" onClick={handleStartTour}>
            Start Tour
          </Button>
        </div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted, #94a3b8)' }}>
          You can replay this tour anytime from the "Replay Tour" button on the dashboard.
        </p>
      </div>
    </Modal>
  );
}

/** Re-export the steps so DashboardPage's Replay Tour button can use them. */
export { WELCOME_STEPS, WELCOME_TOUR_ID };
