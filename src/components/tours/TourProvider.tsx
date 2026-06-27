import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import { Joyride, STATUS, type Step } from 'react-joyride';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { updateAppProfile, getAppProfile } from '../../api/profile';
import { tr, useLocale } from '../../lib/i18n';
import './help-mode.css';

interface HelpModeContextType {
  isHelpModeActive: boolean;
  toggleHelpMode: () => void;
  setHelpMode: (active: boolean) => void;
  activeGuideId: string | null;
  setActiveGuideId: (id: string | null) => void;
  clearActiveGuide: () => void;
}

const HelpModeContext = createContext<HelpModeContextType | null>(null);

export function useHelpMode() {
  const ctx = useContext(HelpModeContext);
  if (!ctx) throw new Error('useHelpMode must be used within TourProvider');
  return ctx;
}

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
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);
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
    (tourId: string) => completedTours.includes(tourId),
    [completedTours],
  );

  const markTourCompleted = useCallback(
    (tourId: string) => {
      if (!isTourCompleted(tourId)) {
        updateProfile({ completed_tours: [...completedTours, tourId] });
      }
    },
    [completedTours, isTourCompleted, updateProfile],
  );

  const locale = useLocale();

  const STEP_DEFAULTS: Partial<Step> = useMemo(
    () => ({
      // Skip the click-to-open beacon: continuous tours should show the
      // tooltip immediately and auto-advance via Next. Without this, react-
      // joyride v3 renders an off-screen beacon and no tooltip, so the tour
      // silently appears broken (the production symptom).
      skipBeacon: true,
      buttons: ['skip', 'back', 'close', 'primary'],
      closeButtonAction: 'skip' as const,
      locale: { skip: tr('tour.exitTour', locale), last: tr('tour.done', locale) },
    }),
    [locale],
  );

  const startTour = useCallback(
    (tourId: string, tourSteps: Step[], force = false) => {
      if (!force && isTourCompleted(tourId)) {
        return;
      }
      // Defer one frame so freshly-rendered pages have their tour targets in
      // the DOM, then keep only steps whose target actually exists. A missing
      // early target otherwise aborts the whole tour ("breaks immediately"),
      // so filtering makes tours resilient across the site.
      requestAnimationFrame(() => {
        const usable = tourSteps.filter((s) => {
          const target = s.target;
          if (typeof target !== 'string') {
            return true;
          }
          try {
            return document.querySelector(target) != null;
          } catch {
            return false;
          }
        });
        if (usable.length === 0) {
          return;
        }
        setActiveTourId(tourId);
        setSteps(usable.map((s) => ({ ...STEP_DEFAULTS, ...s })));
        setRun(true);
      });
    },
    [isTourCompleted, STEP_DEFAULTS],
  );

  const handleJoyrideCallback = useCallback(
    (data: { status?: string }) => {
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
    [activeTourId, markTourCompleted],
  );

  const clearActiveGuide = useCallback(() => setActiveGuideId(null), []);

  const setHelpMode = useCallback((active: boolean) => {
    setHelpModeActive(active);
    if (!active) {
      setActiveGuideId(null);
    }
  }, []);

  const toggleHelpMode = useCallback(() => {
    setHelpModeActive((prev) => {
      const next = !prev;
      if (!next) {
        setActiveGuideId(null);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isHelpModeActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !activeGuideId) return;
      e.preventDefault();
      e.stopPropagation();
      setActiveGuideId(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isHelpModeActive, activeGuideId]);

  const helpModeValue = useMemo(
    () => ({
      isHelpModeActive,
      toggleHelpMode,
      setHelpMode,
      activeGuideId,
      setActiveGuideId,
      clearActiveGuide,
    }),
    [isHelpModeActive, toggleHelpMode, setHelpMode, activeGuideId, clearActiveGuide],
  );

  const tourValue = useMemo(
    () => ({ startTour, markTourCompleted, isTourCompleted }),
    [startTour, markTourCompleted, isTourCompleted],
  );

  return (
    <HelpModeContext.Provider value={helpModeValue}>
      <TourContext.Provider value={tourValue}>
        {children}
        <Joyride
          onEvent={handleJoyrideCallback}
          continuous
          run={run}
          steps={steps}
          scrollToFirstStep
        />
      </TourContext.Provider>
    </HelpModeContext.Provider>
  );
}

export function HelpModeBanner(): ReactNode {
  const locale = useLocale();
  const { isHelpModeActive } = useHelpMode();
  if (!isHelpModeActive) return null;
  return (
    <p className="help-mode-banner" role="status">
      {tr('guide.modeActiveHint', locale)}
    </p>
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
  children: ReactNode;
  className?: string;
}) {
  const locale = useLocale();
  const { isHelpModeActive, activeGuideId, setActiveGuideId, clearActiveGuide } = useHelpMode();
  const isActive = isHelpModeActive && activeGuideId === id;

  const activateGuide = useCallback(
    (e: React.MouseEvent) => {
      if (!isHelpModeActive) return;
      e.preventDefault();
      e.stopPropagation();
      setActiveGuideId(isActive ? null : id);
    },
    [isHelpModeActive, isActive, id, setActiveGuideId],
  );

  const wrapperClass = [
    className,
    isHelpModeActive ? 'help-mode-target' : '',
    isActive ? 'help-mode-target--active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      id={id}
      className={wrapperClass || undefined}
      onClickCapture={isHelpModeActive ? activateGuide : undefined}
      role={isHelpModeActive ? 'group' : undefined}
      aria-label={isHelpModeActive && title ? title : undefined}
    >
      {children}
      {isActive ? (
        <div className="help-mode-note" aria-labelledby={`${id}-guide-title`}>
          <button
            type="button"
            className="help-mode-note__close"
            aria-label={tr('guide.closeNote', locale)}
            onClick={(e) => {
              e.stopPropagation();
              clearActiveGuide();
            }}
          >
            ×
          </button>
          {title ? (
            <h4 id={`${id}-guide-title`} className="help-mode-note__title">
              {title}
            </h4>
          ) : null}
          <p className="help-mode-note__body">{content}</p>
        </div>
      ) : null}
    </div>
  );
}
