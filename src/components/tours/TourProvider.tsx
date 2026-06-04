import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Joyride, STATUS, type Step } from 'react-joyride';
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
  startTour: (tourId: string, steps: Step[]) => void;
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
  const [steps, setSteps] = useState<Step[]>([]);
  const [activeTourId, setActiveTourId] = useState<string | null>(null);

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
    (tourId: string, tourSteps: Step[]) => {
      if (!isTourCompleted(tourId)) {
        setActiveTourId(tourId);
        setSteps(tourSteps);
        setRun(true);
      }
    },
    [isTourCompleted]
  );

  const handleJoyrideCallback = useCallback(
    (data: any) => {
      const { status } = data;
      const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
      
      if (finishedStatuses.includes(status as string)) {
        setRun(false);
        if (activeTourId) {
          markTourCompleted(activeTourId);
          setActiveTourId(null);
        }
      }
    },
    [activeTourId, markTourCompleted]
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
          onEvent={handleJoyrideCallback}
          continuous
          // removed hideCloseButton
          run={run}
          steps={steps}
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
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      id={id}
      className={className}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        ...(isHelpModeActive
          ? { outline: '2px dashed #10b981', outlineOffset: '2px', borderRadius: '4px', cursor: 'help' }
          : {})
      }}
    >
      {children}
      {isHelpModeActive && isHovered && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translate(-50%, -8px)',
            background: 'var(--bg-surface, #1e293b)',
            color: 'var(--text-main, #f8fafc)',
            padding: '0.75rem',
            borderRadius: '6px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
            width: 'max-content',
            maxWidth: '300px',
            zIndex: 10001,
            pointerEvents: 'none',
            border: '1px solid var(--border, #334155)',
            textAlign: 'left'
          }}
        >
          {title && <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#10b981' }}>{title}</h4>}
          <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: '1.4' }}>{content}</p>
        </div>
      )}
    </div>
  );
}
