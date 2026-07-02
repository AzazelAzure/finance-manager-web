import type { BillCadence } from "./billCadence";
import type { UpcomingExpenseRecord } from "../api/types";
import { isDueOnProfileToday, profileTodayIso } from "./profileDate";

const MONTHLY_FALLBACK_DAYS = 30;
const MAX_CATCH_UP_PERIODS = 24;
const SEMIMONTHLY_ANCHORS = [1, 15] as const;

export type BillCadenceFields = Pick<UpcomingExpenseRecord, "cadence" | "custom_interval_days">;

function parseIsoParts(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return { year: year || 1970, month: month || 1, day: day || 1 };
}

function formatIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addMonthsClamped(year: number, month: number, day: number, delta: number): string {
  const targetMonthIndex = month - 1 + delta;
  const target = new Date(year, targetMonthIndex, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return formatIso(target.getFullYear(), target.getMonth() + 1, Math.min(day, lastDay));
}

function firstOfNextMonth(year: number, month: number): string {
  if (month === 12) {
    return formatIso(year + 1, 1, 1);
  }
  return formatIso(year, month + 1, 1);
}

/** Mirror API `bill_recurrence._advance_semimonthly`. */
export function advanceSemimonthlyDueDate(dueIso: string): string {
  const { year, month, day } = parseIsoParts(dueIso);
  if (day === SEMIMONTHLY_ANCHORS[0]) {
    return formatIso(year, month, SEMIMONTHLY_ANCHORS[1]);
  }
  if (day === SEMIMONTHLY_ANCHORS[1]) {
    return firstOfNextMonth(year, month);
  }
  if (day < SEMIMONTHLY_ANCHORS[1]) {
    return formatIso(year, month, SEMIMONTHLY_ANCHORS[1]);
  }
  return firstOfNextMonth(year, month);
}

function addDaysIso(dueIso: string, days: number): string {
  const { year, month, day } = parseIsoParts(dueIso);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return formatIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Advance one cadence period from `dueIso` (API `add_interval_to_date` parity). */
export function advanceBillDueDateIso(dueIso: string, bill: BillCadenceFields): string {
  const cadence = bill.cadence ?? "monthly";
  if (cadence === "semimonthly") {
    return advanceSemimonthlyDueDate(dueIso);
  }
  if (cadence === "weekly") {
    return addDaysIso(dueIso, 7);
  }
  if (cadence === "biweekly") {
    return addDaysIso(dueIso, 14);
  }
  if (cadence === "monthly") {
    const { year, month, day } = parseIsoParts(dueIso);
    return addMonthsClamped(year, month, day, 1);
  }
  if (cadence === "quarterly") {
    const { year, month, day } = parseIsoParts(dueIso);
    return addMonthsClamped(year, month, day, 3);
  }
  if (cadence === "annual") {
    const { year, month, day } = parseIsoParts(dueIso);
    return formatIso(year + 1, month, day);
  }
  if (cadence === "custom") {
    const step = bill.custom_interval_days && bill.custom_interval_days > 0 ? bill.custom_interval_days : 30;
    return addDaysIso(dueIso, step);
  }
  const { year, month, day } = parseIsoParts(dueIso);
  return addMonthsClamped(year, month, day, 1);
}

/** Next due date after the current period (cadence engine; for auto-deduct preview). */
export function nextBillDueDateAfterCurrent(dueIso: string, bill: BillCadenceFields): string {
  return advanceBillDueDateIso(dueIso, bill);
}

export function billIntervalDays(row: Pick<UpcomingExpenseRecord, "start_date" | "due_date">): number {
  if (row.start_date && row.due_date) {
    const start = new Date(`${row.start_date}T12:00:00`).getTime();
    const due = new Date(`${row.due_date}T12:00:00`).getTime();
    const days = Math.round((due - start) / 86_400_000);
    if (days > 0) {
      return days;
    }
  }
  return MONTHLY_FALLBACK_DAYS;
}

export function isOverdueUnpaid(
  row: Pick<UpcomingExpenseRecord, "due_date" | "paid_flag">,
  today = profileTodayIso("UTC"),
): boolean {
  return !row.paid_flag && Boolean(row.due_date) && row.due_date < today;
}

/** Profile-TZ-aware overdue check. */
export function isOverdueUnpaidInTimezone(
  row: Pick<UpcomingExpenseRecord, "due_date" | "paid_flag">,
  timezone: string,
  now = new Date(),
): boolean {
  return !row.paid_flag && Boolean(row.due_date) && row.due_date < profileTodayIso(timezone, now);
}

export { isDueOnProfileToday, profileTodayIso };

/** UI estimate for missed periods — API enforces the authoritative cap on catch-up. */
export function estimateMissedPeriods(
  row: Pick<UpcomingExpenseRecord, "start_date" | "due_date" | "paid_flag">,
  today = profileTodayIso("UTC"),
): number {
  if (!isOverdueUnpaid(row, today) || !row.due_date) {
    return 0;
  }
  const stepDays = billIntervalDays(row);
  let due = new Date(`${row.due_date}T12:00:00`);
  const todayDate = new Date(`${today}T12:00:00`);
  let periods = 0;
  while (due < todayDate && periods < MAX_CATCH_UP_PERIODS) {
    due.setDate(due.getDate() + stepDays);
    periods += 1;
  }
  return periods;
}

export function billCadenceFromDraft(cadence: BillCadence, customIntervalDays: string): BillCadenceFields {
  return {
    cadence,
    custom_interval_days:
      cadence === "custom" && customIntervalDays && Number(customIntervalDays) > 0
        ? Number(customIntervalDays)
        : null,
  };
}
