/**
 * Profile-timezone calendar dates for bill due checks (not browser-local UTC midnight).
 */

/** ISO `YYYY-MM-DD` for "today" in the given IANA timezone. */
export function profileTodayIso(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Whether `dueDateIso` equals profile-timezone today. */
export function isDueOnProfileToday(dueDateIso: string, timezone: string, now = new Date()): boolean {
  const due = dueDateIso.trim().slice(0, 10);
  if (!due) {
    return false;
  }
  return due === profileTodayIso(timezone, now);
}
