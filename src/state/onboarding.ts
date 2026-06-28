export type OnboardingProgress = {
  profile_preferences_saved: boolean;
  source_added: boolean;
  category_added: boolean;
  onboarding_completed: boolean;
};

const ONBOARDING_KEY = "fm_onboarding_progress_v1";
// Onboarding is only ever shown while this marker is set. It is set on account
// creation (signup) or an explicit "run setup again" from Profile, and cleared
// when the wizard is finished or skipped. Existing users logging in never have
// it, so they go straight to the dashboard.
const ONBOARDING_ACTIVE_KEY = "fm_onboarding_active_v1";

const DEFAULT_PROGRESS: OnboardingProgress = {
  profile_preferences_saved: false,
  source_added: false,
  category_added: false,
  onboarding_completed: false,
};

function safeParse(raw: string | null): Partial<OnboardingProgress> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<OnboardingProgress>;
  } catch {
    return null;
  }
}

export function getOnboardingProgress(): OnboardingProgress {
  if (typeof localStorage === "undefined") {
    return DEFAULT_PROGRESS;
  }
  const parsed = safeParse(localStorage.getItem(ONBOARDING_KEY));
  if (!parsed) {
    return DEFAULT_PROGRESS;
  }
  return {
    profile_preferences_saved: Boolean(parsed.profile_preferences_saved),
    source_added: Boolean(parsed.source_added),
    category_added: Boolean(parsed.category_added),
    onboarding_completed: Boolean(parsed.onboarding_completed),
  };
}

export function setOnboardingProgress(next: Partial<OnboardingProgress>): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  const merged = { ...getOnboardingProgress(), ...next };
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(merged));
}

export function clearOnboardingProgress(): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(ONBOARDING_KEY);
}

/** True only while a new-account (or manually restarted) onboarding run is in progress. */
export function isOnboardingActive(): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }
  return localStorage.getItem(ONBOARDING_ACTIVE_KEY) === "1";
}

/** Begin an onboarding run (called on signup or manual restart). */
export function activateOnboarding(): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(ONBOARDING_ACTIVE_KEY, "1");
}

/** End the onboarding run without touching step progress. */
export function deactivateOnboarding(): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(ONBOARDING_ACTIVE_KEY);
}

/** Mark the wizard finished/skipped: complete all steps and end the run. */
export function completeOnboarding(): void {
  setOnboardingProgress({
    profile_preferences_saved: true,
    source_added: true,
    category_added: true,
    onboarding_completed: true,
  });
  deactivateOnboarding();
}

/**
 * Where the user should land for onboarding. Returns the dashboard whenever no
 * onboarding run is active, so existing users are never redirected into the wizard.
 */
export function earliestIncompleteOnboardingPath(progress = getOnboardingProgress()): string {
  if (!isOnboardingActive()) return "/app/dashboard";
  if (progress.onboarding_completed) return "/app/dashboard";
  if (!progress.profile_preferences_saved) return "/app/onboarding";
  if (!progress.source_added) return "/app/onboarding/sources";
  return "/app/dashboard";
}

/** Re-open the short setup wizard (currency + first source). */
export function restartOnboardingWizard(): void {
  setOnboardingProgress({
    profile_preferences_saved: false,
    source_added: false,
    category_added: false,
    onboarding_completed: false,
  });
  activateOnboarding();
}
