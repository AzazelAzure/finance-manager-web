import { useCallback, useState, type ReactNode } from "react";
import { Button } from "./ui/Button";

/** Host-scoped stored consent; avoids `Domain=.thehivemanager.com` cookies affecting all subdomains. */
const LS_KEY = "fm_cookie_consent_v1";
const LEGACY_NAME = "fm_cookie_consent";
const HOST_ONLY_NAME = "__Host-fm_cookie_consent";
const ONE_YEAR = 60 * 60 * 24 * 365;

function getLocalStorageConsent(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

function setLocalStorageConsent(): void {
  try {
    localStorage.setItem(LS_KEY, "1");
  } catch {
    /* private mode or quota; cookie path still runs */
  }
}

/**
 * Whether the user has already accepted (origin `localStorage` only).
 * We intentionally do **not** treat `document.cookie` alone as proof: a cookie
 * set with `Domain=.thehivemanager.com` is visible on every jsdev* host and
 * looked like "consent" even in a fresh incognito session.
 */
function hasAccepted(): boolean {
  return getLocalStorageConsent();
}

function writeHostOrLegacyCookie(): void {
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  if (secure) {
    document.cookie = `${HOST_ONLY_NAME}=1; Max-Age=${ONE_YEAR}; Path=/; Secure; SameSite=Lax`;
  } else {
    document.cookie = `${LEGACY_NAME}=1; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax`;
  }
}

type Props = { onAccept?: () => void };

export function CookieBanner({ onAccept }: Props): ReactNode {
  const [visible, setVisible] = useState(() => !hasAccepted());

  const accept = useCallback((): void => {
    setLocalStorageConsent();
    writeHostOrLegacyCookie();
    setVisible(false);
    onAccept?.();
  }, [onAccept]);

  if (!visible) {
    return null;
  }

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie notice" aria-live="polite">
      <p style={{ margin: 0, flex: "1 1 12rem" }}>
        We use cookies to remember this notice and to support your session. By continuing, you accept our use of
        essential cookies.
      </p>
      <Button type="button" onClick={accept}>
        Accept
      </Button>
    </div>
  );
}
