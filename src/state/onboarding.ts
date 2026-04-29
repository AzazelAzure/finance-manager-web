export type OnboardingProgress = {
  profile_preferences_saved: boolean;
  source_added: boolean;
  category_added: boolean;
};

const ONBOARDING_KEY = "fm_onboarding_progress_v1";
const FORCE_ONBOARDING_KEY = "fm_force_onboarding_next_login_v1";

const DEFAULT_PROGRESS: OnboardingProgress = {
  profile_preferences_saved: false,
  source_added: false,
  category_added: false,
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

export function earliestIncompleteOnboardingPath(progress = getOnboardingProgress()): string {
  if (!progress.profile_preferences_saved) return "/app/onboarding";
  if (!progress.source_added) return "/app/onboarding/sources";
  if (!progress.category_added) return "/app/onboarding/categories";
  return "/app/onboarding/review";
}

export function markForceOnboardingNextLogin(): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(FORCE_ONBOARDING_KEY, "1");
}

export function consumeForceOnboardingNextLogin(): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }
  const shouldForce = localStorage.getItem(FORCE_ONBOARDING_KEY) === "1";
  if (shouldForce) {
    localStorage.removeItem(FORCE_ONBOARDING_KEY);
  }
  return shouldForce;
}
