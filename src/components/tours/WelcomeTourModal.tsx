import { useState, type ReactNode } from 'react';
import { useTour } from './TourProvider';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { tr, useLocale, type AppLocale } from '../../lib/i18n';
import type { Step } from 'react-joyride';

export const WELCOME_TOUR_ID = 'onboarding_welcome_tour';

/**
 * Build localized steps for the welcome tour.
 * Called at render time so the active locale is always used.
 */
export function buildWelcomeSteps(locale: AppLocale): Step[] {
  return [
    {
      target: '.dashboard-page',
      title: tr('tour.dashboard.welcome.title', locale),
      content: tr('tour.dashboard.welcome.content', locale),
      placement: 'center',
      skipBeacon: true,
    },
    {
      target: '#tour-kpis',
      title: tr('tour.dashboard.kpis.title', locale),
      content: tr('tour.dashboard.kpis.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tour-kpis',
      title: tr('tour.dashboard.leaks.title', locale),
      content: tr('tour.dashboard.leaks.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tour-quick-actions',
      title: tr('tour.dashboard.quickActions.title', locale),
      content: tr('tour.dashboard.quickActions.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tour-filters',
      title: tr('tour.dashboard.filters.title', locale),
      content: tr('tour.dashboard.filters.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tour-replay-btn',
      title: tr('tour.dashboard.replayBtn.title', locale),
      content: tr('tour.dashboard.replayBtn.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tour-refresh-btn',
      title: tr('tour.dashboard.refreshBtn.title', locale),
      content: tr('tour.dashboard.refreshBtn.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tour-flow-chart',
      title: tr('tour.dashboard.flowChart.title', locale),
      content: tr('tour.dashboard.flowChart.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tour-spend-chart',
      title: tr('tour.dashboard.spendChart.title', locale),
      content: tr('tour.dashboard.spendChart.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tour-category-pie',
      title: tr('tour.dashboard.categoryPie.title', locale),
      content: tr('tour.dashboard.categoryPie.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tour-tag-pie',
      title: tr('tour.dashboard.tagPie.title', locale),
      content: tr('tour.dashboard.tagPie.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tour-source-balances',
      title: tr('tour.dashboard.sourceBalances.title', locale),
      content: tr('tour.dashboard.sourceBalances.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tour-profile-overview',
      title: tr('tour.dashboard.profileOverview.title', locale),
      content: tr('tour.dashboard.profileOverview.content', locale),
      skipBeacon: true,
    },
    {
      target: '#tour-recent-tx',
      title: tr('tour.dashboard.recentTx.title', locale),
      content: tr('tour.dashboard.recentTx.content', locale),
      skipBeacon: true,
    },
    {
      target: '.protected-side-nav',
      title: tr('tour.dashboard.sideNav.title', locale),
      content: tr('tour.dashboard.sideNav.content', locale),
      placement: 'right',
      skipBeacon: true,
    },
  ];
}

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
  const locale = useLocale();
  const { isTourCompleted, startTour, markTourCompleted } = useTour();
  const [dismissed, setDismissed] = useState(false);

  const alreadyCompleted = isTourCompleted(WELCOME_TOUR_ID);
  const showModal = dataReady && !alreadyCompleted && !dismissed;

  function handleStartTour(): void {
    setDismissed(true);
    startTour(WELCOME_TOUR_ID, buildWelcomeSteps(locale));
  }

  function handleSkip(): void {
    setDismissed(true);
    markTourCompleted(WELCOME_TOUR_ID);
  }

  return (
    <Modal open={showModal} title={tr('tour.dashboard.welcome.title', locale)} onClose={handleSkip}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
        <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--text-main)' }}>
          {tr('tour.welcomeModalBody', locale)}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button type="button" variant="secondary" onClick={handleSkip}>
            {tr('tour.skipForNow', locale)}
          </Button>
          <Button type="button" variant="primary" onClick={handleStartTour}>
            {tr('tour.startTour', locale)}
          </Button>
        </div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted, #94a3b8)' }}>
          {tr('tour.replayHint', locale)}
        </p>
      </div>
    </Modal>
  );
}
