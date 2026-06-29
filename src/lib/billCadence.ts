import type { AppLocale } from "./i18n";
import { tr, trFmt } from "./i18n";

export const BILL_CADENCES = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "quarterly",
  "annual",
  "custom",
] as const;

export type BillCadence = (typeof BILL_CADENCES)[number];

export function isBillCadence(value: string | undefined | null): value is BillCadence {
  return Boolean(value && (BILL_CADENCES as readonly string[]).includes(value));
}

export function normalizeBillCadence(value: string | undefined | null): BillCadence {
  return isBillCadence(value) ? value : "monthly";
}

export function formatBillCadenceLabel(
  locale: AppLocale,
  cadence: BillCadence,
  customIntervalDays: number | null | undefined,
): string {
  if (cadence === "custom" && customIntervalDays && customIntervalDays > 0) {
    return trFmt("bills.cadence.customEvery", locale, { days: customIntervalDays });
  }
  return tr(`bills.cadence.${cadence}`, locale);
}
