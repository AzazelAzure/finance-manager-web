import { Joyride, STATUS, EVENTS } from 'react-joyride';
import type { Step } from 'react-joyride';
import { useTour } from './TourProvider';

interface GlobalOnboardingTourProps {
  onViewChange: (view: string) => void;
  onFinish: () => void;
  run: boolean;
}

export function GlobalOnboardingTour({ onViewChange, onFinish, run }: GlobalOnboardingTourProps) {
  const { markTourCompleted } = useTour();
  
  const steps: Step[] = [
    {
      target: '#sandbox-dashboard-view',
      content: (
        <div>
          <h3>Welcome to Hive!</h3>
          <p>Let's take a quick tour. This is your Dashboard. It gives you a high-level overview of your cash flow and spending velocity.</p>
        </div>
      ),
      placement: 'center',
    },
    {
      target: '#sandbox-kpi-cards',
      content: (
        <div>
          <h3>Key Performance Indicators</h3>
          <p>These cards help you track income, expenses, and potential leaks (unnecessary spending). Keeping an eye on your leaks helps you build savings faster.</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '#sandbox-nav-transactions',
      content: (
        <div>
          <h3>Transactions</h3>
          <p>Here you can log and categorize your expenses and income.</p>
        </div>
      ),
      placement: 'right',
    },
    {
      target: '#sandbox-transactions-view',
      content: (
        <div>
          <h3>Tracking your money</h3>
          <p>Adding transactions regularly is the foundation of financial literacy. You can't manage what you don't measure!</p>
        </div>
      ),
      placement: 'center',
    },
    {
      target: '#sandbox-nav-calendar',
      content: (
        <div>
          <h3>Financial Calendar</h3>
          <p>Click here to see your Calendar.</p>
        </div>
      ),
      placement: 'right',
    },
    {
      target: '#sandbox-calendar-view',
      content: (
        <div>
          <h3>Plan Ahead</h3>
          <p>Use the calendar to track upcoming bills and subscriptions so you're never caught off guard. Planning is key to financial stability.</p>
        </div>
      ),
      placement: 'center',
    }
  ];

  const handleJoyrideCallback = (data: any) => {
    const { status, type, index, action } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextStepIndex = index + (action === 'prev' ? -1 : 1);
      
      if (nextStepIndex === 3) {
        onViewChange('transactions');
      } else if (nextStepIndex === 5) {
        onViewChange('calendar');
      } else if (nextStepIndex < 3) {
        onViewChange('dashboard');
      }
    }

    if (finishedStatuses.includes(status as string)) {
      markTourCompleted('global_onboarding');
      onFinish();
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      styles={{
        // @ts-ignore
        options: {
          zIndex: 20000,
          primaryColor: 'var(--accent)',
        },
      }} as any
    />
  );
}
