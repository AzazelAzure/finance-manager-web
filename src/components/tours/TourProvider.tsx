import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { Joyride, STATUS } from 'react-joyride';
// @ts-ignore
import type { CallBackProps, Step } from 'react-joyride';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { updateAppProfile, getAppProfile } from '../../api/profile';

// Help Mode Context
interface HelpModeContextType {
  isHelpModeActive: boolean;
  toggleHelpMode: () => void;
  setHelpMode: (active: boolean) => void;
}

const HelpModeContext = createContext<HelpModeContextType | null>(null);

export function useHelpMode() {
  const ctx = useContext(HelpModeContext);
  if (!ctx) throw new Error('useHelpMode must be used within TourProvider');
  return ctx;
}

// Tour Context
interface TourContextType {
  startTour: (tourId: string, steps: Step[], force?: boolean) => void;
  markTourCompleted: (tourId: string) => void;
  isTourCompleted: (tourId: string) => boolean;
}

const TourContext = createContext<TourContextType | null>(null);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isHelpModeActive, setHelpModeActive] = useState(false);
  const [run, setRun] = useState(false);
  const [joyrideKey, setJoyrideKey] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const lastStartWasForceRef = useRef(false);

  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ['app-profile'],
    queryFn: () => getAppProfile(),
  });

  const { mutate: updateProfile } = useMutation({
    mutationFn: updateAppProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-profile'] });
    },
  });

  const completedTours = profile?.completed_tours || [];

  const isTourCompleted = useCallback(
    (tourId: string) => {
      return completedTours.includes(tourId);
    },
    [completedTours]
  );

  const markTourCompleted = useCallback(
    (tourId: string) => {
      if (!isTourCompleted(tourId)) {
        updateProfile({ completed_tours: [...completedTours, tourId] });
      }
    },
    [completedTours, isTourCompleted, updateProfile]
  );

  const startTour = useCallback(
    (id: string, tourSteps: Step[], force = false) => {
      lastStartWasForceRef.current = force;
      if (isTourCompleted(id) && !force) {
        return;
      }
      setSteps(tourSteps);
      setActiveTourId(id);
      setJoyrideKey(Date.now());
      setRun(false);

      // Use setTimeout to ensure the 'run=false' state is processed before re-enabling
      setTimeout(() => {
        setRun(true);
      }, 100);
    },
    [isTourCompleted],
  );

  const handleJoyrideCallback = useCallback(
    (data: any) => {
      const { status, type } = data;
      const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
      
      if (type === 'error') {
        console.error('[TourProvider] Joyride error:', data);
      }

      if (finishedStatuses.includes(status as string)) {
        setRun(false);
        if (activeTourId) {
          // Do not persist help mode contextual notes
          if (!activeTourId.startsWith('help_')) {
            const wasForce = lastStartWasForceRef.current;
            lastStartWasForceRef.current = false;
            const alreadyDone = completedTours.includes(activeTourId);
            if (!wasForce || !alreadyDone) {
              markTourCompleted(activeTourId);
            }
          } else {
            lastStartWasForceRef.current = false;
          }
          setActiveTourId(null);
        }
      }
    },
    [activeTourId, completedTours, markTourCompleted]
  );

  const helpModeValue = useMemo(
    () => ({
      isHelpModeActive,
      toggleHelpMode: () => setHelpModeActive((prev) => !prev),
      setHelpMode: setHelpModeActive,
    }),
    [isHelpModeActive]
  );

  const tourValue = useMemo(
    () => ({ startTour, markTourCompleted, isTourCompleted }),
    [startTour, markTourCompleted, isTourCompleted]
  );

  return (
    <HelpModeContext.Provider value={helpModeValue}>
      <TourContext.Provider value={tourValue}>
        {children}
        <Joyride
          key={joyrideKey}
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
              primaryColor: '#10b981', // Tailwind green
            },
          }} as any
        />
      </TourContext.Provider>
    </HelpModeContext.Provider>
  );
}

export function HelpModeWrapper({
  id,
  title,
  content,
  children,
  className = '',
}: {
  id: string;
  title?: string;
  content: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { isHelpModeActive } = useHelpMode();
  const { startTour } = useTour();

  const handleClick = (e: React.MouseEvent) => {
    if (isHelpModeActive) {
      e.preventDefault();
      e.stopPropagation();
      // Keep help mode active so the user can click multiple widgets
      startTour(`help_${id}_${Date.now()}`, [
        {
          target: `#${id}`,
          title,
          content,
          disableBeacon: true,
          hideFooter: true,
          hideBackButton: true,
        } as any,
      ]);
    }
  };

  return (
    <div
      id={id}
      className={className}
      onClickCapture={handleClick}
      tabIndex={isHelpModeActive ? 0 : undefined}
      role={isHelpModeActive ? 'button' : undefined}
      aria-label={isHelpModeActive ? `Help for ${title || id}` : undefined}
      onKeyDown={(e) => {
        if (isHelpModeActive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick(e as any);
        }
      }}
      style={
        isHelpModeActive
          ? { cursor: 'help', outline: '2px dashed #10b981', outlineOffset: '2px', borderRadius: '4px' }
          : undefined
      }
    >
      {children}
    </div>
  );
}
