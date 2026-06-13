/**
 * Curated timezone list with GMT offset labels and browser auto-detection.
 *
 * Used by both OnboardingPage and SettingsProfilePage so the dropdown is
 * manageable (~40 prominent zones) instead of the full IANA database (~450).
 */

/** One entry per prominent timezone. */
export interface TimezoneOption {
  value: string;   // IANA identifier sent to the API
  label: string;   // Human-readable label with GMT offset
}

/**
 * Curated list of prominent IANA timezones covering every UTC offset.
 * Sorted west→east.  The `value` is the canonical IANA id the API expects.
 */
const PROMINENT_ZONES: readonly string[] = [
  // UTC-12 to UTC-10
  "Pacific/Pago_Pago",      // UTC-11
  "Pacific/Honolulu",       // UTC-10
  // UTC-9 to UTC-8
  "America/Anchorage",      // UTC-9
  "America/Los_Angeles",    // UTC-8
  // UTC-7 to UTC-6
  "America/Denver",         // UTC-7
  "America/Phoenix",        // UTC-7 (no DST)
  "America/Chicago",        // UTC-6
  "America/Mexico_City",    // UTC-6
  // UTC-5 to UTC-4
  "America/New_York",       // UTC-5
  "America/Bogota",         // UTC-5
  "America/Caracas",        // UTC-4
  "America/Halifax",        // UTC-4
  "America/Santiago",       // UTC-4
  // UTC-3 to UTC-2
  "America/Sao_Paulo",      // UTC-3
  "America/Argentina/Buenos_Aires", // UTC-3
  // UTC-1 to UTC+0
  "Atlantic/Azores",        // UTC-1
  "Atlantic/Cape_Verde",    // UTC-1
  "UTC",                    // UTC+0
  "Europe/London",          // UTC+0
  // UTC+1 to UTC+2
  "Europe/Paris",           // UTC+1
  "Europe/Berlin",          // UTC+1
  "Africa/Lagos",           // UTC+1
  "Europe/Athens",          // UTC+2
  "Africa/Cairo",           // UTC+2
  "Africa/Johannesburg",    // UTC+2
  // UTC+3 to UTC+4
  "Europe/Moscow",          // UTC+3
  "Asia/Riyadh",            // UTC+3
  "Africa/Nairobi",         // UTC+3
  "Asia/Dubai",             // UTC+4
  // UTC+4:30 to UTC+5:30
  "Asia/Kabul",             // UTC+4:30
  "Asia/Karachi",           // UTC+5
  "Asia/Kolkata",           // UTC+5:30
  "Asia/Kathmandu",         // UTC+5:45
  // UTC+6 to UTC+7
  "Asia/Dhaka",             // UTC+6
  "Asia/Bangkok",           // UTC+7
  "Asia/Jakarta",           // UTC+7
  // UTC+8
  "Asia/Singapore",         // UTC+8
  "Asia/Manila",            // UTC+8
  "Asia/Shanghai",          // UTC+8
  "Asia/Taipei",            // UTC+8
  "Australia/Perth",        // UTC+8
  // UTC+9 to UTC+10
  "Asia/Tokyo",             // UTC+9
  "Asia/Seoul",             // UTC+9
  "Australia/Sydney",       // UTC+10/+11
  // UTC+12 to UTC+13
  "Pacific/Auckland",       // UTC+12/+13
  "Pacific/Fiji",           // UTC+12
] as const;

/**
 * Format a timezone's current UTC offset as a human-readable string, e.g. "GMT+08:00".
 * Uses `Intl.DateTimeFormat` so it respects daylight-saving state at the current date.
 */
function formatGmtOffset(tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    });
    const parts = fmt.formatToParts(new Date());
    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    // e.g. "GMT+8" or "GMT-05:00" or "GMT"
    return offsetPart?.value ?? "GMT";
  } catch {
    return "GMT";
  }
}

/** Pretty-print a zone id for display: "Asia/Manila" → "Manila", "America/New_York" → "New York". */
function prettyCityName(tz: string): string {
  const city = tz.split("/").pop() ?? tz;
  return city.replace(/_/g, " ");
}

/** Build the label: "(GMT+08:00) Manila" */
function buildLabel(tz: string): string {
  if (tz === "UTC") return "(GMT+00:00) UTC";
  const offset = formatGmtOffset(tz);
  return `(${offset}) ${prettyCityName(tz)}`;
}

/**
 * Detect the user's timezone from the browser (OS-level setting).
 * Falls back to the provided `fallback` if detection fails.
 */
export function detectBrowserTimezone(fallback = "UTC"): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Build the curated timezone option list.
 *
 * - `current` (optional) is an IANA id that must appear even if not in the
 *   prominent list (e.g. the user's saved profile value).
 * - `detected` (optional) is the auto-detected browser timezone to float to top.
 *
 * Returns options sorted west→east, with the detected zone (if found) first.
 */
export function buildTimezoneOptions(opts?: {
  current?: string;
  detected?: string;
}): TimezoneOption[] {
  const current = opts?.current;
  const detected = opts?.detected;

  // Start with our curated set
  const set = new Set(PROMINENT_ZONES);

  // Ensure current profile value is always present
  if (current && !set.has(current)) {
    set.add(current);
  }
  // Ensure detected browser tz is always present
  if (detected && !set.has(detected)) {
    set.add(detected);
  }

  // Build options
  let options: TimezoneOption[] = Array.from(set).map((tz) => ({
    value: tz,
    label: buildLabel(tz),
  }));

  // Sort by GMT offset string (works because of the (GMT±HH:MM) prefix)
  options.sort((a, b) => a.label.localeCompare(b.label));

  // Float detected to the very top if present
  if (detected) {
    const idx = options.findIndex((o) => o.value === detected);
    if (idx > 0) {
      const [item] = options.splice(idx, 1);
      item.label = `★ ${item.label}`;
      options.unshift(item);
    } else if (idx === 0) {
      options[0].label = `★ ${options[0].label}`;
    }
  }

  return options;
}
