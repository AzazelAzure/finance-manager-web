import type { UpcomingExpenseRecord } from "../api/types";

const MONTHLY_FALLBACK_DAYS = 30;
const MAX_CATCH_UP_PERIODS = 24;

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
  today = new Date().toISOString().slice(0, 10),
): boolean {
  return !row.paid_flag && Boolean(row.due_date) && row.due_date < today;
}

/** UI estimate for missed periods — API enforces the authoritative cap on catch-up. */
export function estimateMissedPeriods(
  row: Pick<UpcomingExpenseRecord, "start_date" | "due_date" | "paid_flag">,
  today = new Date().toISOString().slice(0, 10),
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
