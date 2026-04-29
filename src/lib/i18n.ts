const LOCALE_COOKIE = "fm_locale";
const DEFAULT_LOCALE = "en-US";

export type AppLocale = "en-US" | "tl-PH";

export function getLocale(): AppLocale {
  if (typeof document === "undefined") {
    return DEFAULT_LOCALE;
  }
  const hit = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`));
  if (hit) {
    const v = hit.split("=")[1] as AppLocale;
    if (v === "en-US" || v === "tl-PH") {
      return v;
    }
  }
  return DEFAULT_LOCALE;
}

export function setLocale(loc: AppLocale): void {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${loc}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event("fm-locale-changed"));
}

/** Placeholder for future messages; this sweep remains English-only. */
export function tr(key: string): string {
  return key;
}
