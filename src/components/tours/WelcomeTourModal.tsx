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
  {
    target: '.dashboard-page',
    title: 'Welcome to Hive Financial Manager!',
    content: 'This is your financial dashboard — a real-time snapshot of your money. Everything you see here updates as you log transactions. Let\'s walk through the key areas.',
    placement: 'center',
    skipBeacon: true,
  },
  {
    target: '#tour-kpis',
    title: 'Financial Health at a Glance',
    content: 'These KPI cards show your income, expenses, and "leaks" for the current period. Leaks track hidden costs in account transfers — ATM withdrawal fees, cash-out/cash-in fees, transfer charges, and similar losses that silently chip away at your balance.',
    skipBeacon: true,
  },
  {
    target: '#tour-quick-actions',
    title: 'Log Transactions Quickly',
    content: 'Use these shortcuts to record income or expenses on the fly. The sooner you log transactions, the more accurate your charts and budgets will be.',
    skipBeacon: true,
  },
  {
    target: '#tour-filters',
    title: 'Analyze Specific Periods',
    content: 'Filter your data by month, year, or custom dates. Regularly reviewing past months helps you spot seasonal spending habits and plan ahead.',
    skipBeacon: true,
  },
  {
    target: '#tour-charts',
    title: 'Visualize Your Spending',
    content: 'These charts break down where your money goes. Click any category slice to drill into the specific transactions making up that total.',
    skipBeacon: true,
  },
  {
    target: '.protected-side-nav',
    title: 'Navigate the App',
    content: 'Use the sidebar to access Transactions, Calendar, Upcoming Expenses, Data Hub, and your Profile Settings. Each page has its own quick guide you can trigger later. Tap the Guide (book) icon anytime to toggle Help Mode — hover over any section to see a quick tooltip.',
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
