import { useCallback, useState, type ReactNode } from "react";
import { Button } from "./ui/Button";

const CONSENT_COOKIE = "fm_cookie_consent";
const ONE_YEAR = 60 * 60 * 24 * 365;

function readConsent(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${CONSENT_COOKIE}=1`));
}

function writeConsent(): void {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=1; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax${secure}`;
}

type Props = { onAccept?: () => void };

export function CookieBanner({ onAccept }: Props): ReactNode {
  const [visible, setVisible] = useState(() => !readConsent());

  const accept = useCallback((): void => {
    writeConsent();
    setVisible(false);
    onAccept?.();
  }, [onAccept]);

  if (!visible) {
    return null;
  }

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie notice">
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
