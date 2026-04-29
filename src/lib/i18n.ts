import { useEffect, useState } from "react";

const LOCALE_COOKIE = "fm_locale";
const DEFAULT_LOCALE = "en-US";

export type AppLocale = "en-US" | "tl-PH";

const MESSAGES: Record<AppLocale, Record<string, string>> = {
  "en-US": {
    "hero.eyebrow": "Finance clarity, built for daily use",
    "hero.title": "Know your money. Plan with confidence.",
    "hero.body": "Dashboards, transactions, bills, and a data hub — tuned for how you really spend and save.",
    "hero.getStarted": "Get started",
    "hero.openApp": "Open app",
    "hero.signIn": "Sign in",
    "value.title": "Why people use Hive",
    "value.clarity.title": "Clarity in one place",
    "value.clarity.body": "Income, spend, and balances roll up to a single snapshot you can trust.",
    "value.bills.title": "Bills, not surprises",
    "value.bills.body": "Track upcoming expenses and stay ahead of due dates and renewals.",
    "value.data.title": "Your data, your rules",
    "value.data.body": "Tag, filter, and dig into sources and categories without the clutter.",
    "value.daily.title": "Quick daily check-ins",
    "value.daily.body": "Open your dashboard, spot changes fast, and take action in a few clicks.",
    "showcase.title": "In the app",
    "showcase.tabs.dashboard": "Dashboard",
    "showcase.tabs.transactions": "Transactions",
    "showcase.tabs.bills": "Bills",
    "showcase.tabs.dataHub": "Data hub",
    "showcase.dashboard.blurb": "KPIs, flow charts, and source balances in one view.",
    "showcase.transactions.blurb": "Filter, tag, and drill in without leaving the table.",
    "showcase.bills.blurb": "Recurring, paid, and upcoming in a pipeline you can scan in seconds.",
    "showcase.dataHub.blurb": "Sources, categories, and tags stay tidy as your life changes.",
    "preview.title": "Product preview",
    "preview.note": "Numbers below are demo data showing how dashboard + ledger surfaces look in the current web app.",
    "preview.sourceBalances": "Source balances",
    "preview.table.when": "When",
    "preview.table.description": "Description",
    "preview.table.source": "Source",
    "preview.table.amount": "Amount",
    "roadmap.title": "On the roadmap",
    "roadmap.insights.title": "Deeper insights",
    "roadmap.insights.body": "More drilldowns and saved report views from your data.",
    "roadmap.imports.title": "Smarter imports",
    "roadmap.imports.body": "Bring in more sources with guided mapping and validation.",
    "roadmap.shared.title": "Shared spaces",
    "roadmap.shared.body": "Household and advisor views with clear permissions.",
    "roadmap.api.title": "API + mobile",
    "roadmap.api.body": "First-class API keys and a companion app when you are on the go.",
    "cta.title": "Ready to try it?",
    "header.login": "Log in",
    "header.getStarted": "Get started",
    "locale.aria": "Interface language",
    "login.title": "Log in",
    "login.helper":
      "Access your dashboard. Fields stay empty until you focus them, so the app does not pre-fill credentials; your browser may still offer saved passwords after you click in a field.",
    "login.submit": "Sign in",
    "login.submitting": "Signing in…",
    "signup.title": "Create account",
    "signup.helper":
      "Create your Hive account, then you will be signed in and sent to the dashboard. Onboarding preferences ship in a later task.",
    "signup.submit": "Create account",
    "signup.submitting": "Creating account…",
    "signup.haveAccount": "Already have an account?",
    "signup.backHome": "Back home",
  },
  "tl-PH": {
    "hero.eyebrow": "Luminaw ang pananalapi, para sa araw-araw",
    "hero.title": "Kilalanin ang pera mo. Magplano nang may kumpiyansa.",
    "hero.body": "Dashboard, transaksyon, bills, at data hub — akma sa totoong paraan ng paggastos at pag-iipon mo.",
    "hero.getStarted": "Magsimula",
    "hero.openApp": "Buksan ang app",
    "hero.signIn": "Mag-sign in",
    "value.title": "Bakit ginagamit ang Hive",
    "value.clarity.title": "Lahat malinaw sa iisang lugar",
    "value.clarity.body": "Kita, gastos, at balanse ay pinagsasama sa iisang snapshot na mapagkakatiwalaan.",
    "value.bills.title": "Bills na hindi nakakagulat",
    "value.bills.body": "Subaybayan ang paparating na bayarin at manatiling handa bago dumating ang due date.",
    "value.data.title": "Data mo, rules mo",
    "value.data.body": "Mag-tag, mag-filter, at maghukay sa sources at categories nang walang kalat.",
    "value.daily.title": "Mabilis na daily check-in",
    "value.daily.body": "Buksan ang dashboard, makita agad ang galaw, at kumilos sa ilang click lang.",
    "showcase.title": "Sa loob ng app",
    "showcase.tabs.dashboard": "Dashboard",
    "showcase.tabs.transactions": "Mga transaksyon",
    "showcase.tabs.bills": "Mga bayarin",
    "showcase.tabs.dataHub": "Data hub",
    "showcase.dashboard.blurb": "KPIs, flow charts, at source balances sa iisang view.",
    "showcase.transactions.blurb": "Mag-filter, mag-tag, at mag-drill nang hindi umaalis sa table.",
    "showcase.bills.blurb": "Recurring, paid, at upcoming sa pipeline na mabilis i-scan.",
    "showcase.dataHub.blurb": "Mananatiling maayos ang sources, categories, at tags habang nagbabago ang buhay mo.",
    "preview.title": "Preview ng produkto",
    "preview.note": "Ang nasa ibaba ay demo data para ipakita ang hitsura ng dashboard at ledger sa kasalukuyang web app.",
    "preview.sourceBalances": "Balanse ng sources",
    "preview.table.when": "Kailan",
    "preview.table.description": "Paglalarawan",
    "preview.table.source": "Source",
    "preview.table.amount": "Halaga",
    "roadmap.title": "Nasa roadmap",
    "roadmap.insights.title": "Mas malalim na insights",
    "roadmap.insights.body": "Mas maraming drilldown at saved report views mula sa data mo.",
    "roadmap.imports.title": "Mas matalinong imports",
    "roadmap.imports.body": "Magdagdag ng mas maraming sources na may guided mapping at validation.",
    "roadmap.shared.title": "Shared spaces",
    "roadmap.shared.body": "Household at advisor views na may malinaw na permissions.",
    "roadmap.api.title": "API + mobile",
    "roadmap.api.body": "First-class API keys at companion app kapag on the go ka.",
    "cta.title": "Handa ka na bang subukan?",
    "header.login": "Mag-sign in",
    "header.getStarted": "Magsimula",
    "locale.aria": "Wika ng interface",
    "login.title": "Mag-sign in",
    "login.helper":
      "I-access ang dashboard mo. Mananatiling walang laman ang fields hanggang i-focus mo ito, kaya hindi awtomatikong nagpa-fill ng credentials ang app; maaaring mag-alok pa rin ang browser ng saved passwords pagkatapos mong i-click ang field.",
    "login.submit": "Mag-sign in",
    "login.submitting": "Nagsi-sign in…",
    "signup.title": "Gumawa ng account",
    "signup.helper":
      "Gumawa ng Hive account, saka ka awtomatikong isi-sign in at dadalhin sa dashboard. Darating ang onboarding preferences sa susunod na task.",
    "signup.submit": "Gumawa ng account",
    "signup.submitting": "Gumagawa ng account…",
    "signup.haveAccount": "May account ka na ba?",
    "signup.backHome": "Bumalik sa home",
  },
};

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

export function tr(key: string, locale?: AppLocale): string {
  const loc = locale ?? getLocale();
  return MESSAGES[loc]?.[key] ?? MESSAGES["en-US"]?.[key] ?? key;
}

export function useLocale(): AppLocale {
  const [locale, setLocaleState] = useState<AppLocale>(() => getLocale());

  useEffect(() => {
    const onChange = (): void => setLocaleState(getLocale());
    window.addEventListener("fm-locale-changed", onChange);
    return () => window.removeEventListener("fm-locale-changed", onChange);
  }, []);

  return locale;
}
