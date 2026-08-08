/**
 * Time handling — the two decisions the assessment asks us to reason about.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DECISION 1 — Store UTC, display local.
 *
 * Every session datetime is stored as an ISO-8601 UTC string ("...Z"). The UI
 * always renders it through `Intl.DateTimeFormat`, which converts the instant to
 * the parent's OWN browser timezone. This way the same stored value shows
 * "Sat, Aug 9 at 9:30 AM" to a parent in Seattle and "Sat, Aug 9 at 10:00 PM"
 * to a parent in Mumbai, and both of them are the SAME physical moment. If we
 * stored local wall-clock strings instead, the backend could never know whose
 * "local" we meant, and sessions would silently shift when a parent travels.
 *
 * When the parent PICKs a new slot, the form is in local wall-clock terms
 * (a `<input type="date">` + hour grid). We convert local → UTC with a local-
 * time Date constructor: `new Date(y, m-1, d, hour, min)` interprets the parts
 * as LOCAL time (DST transitions included — the JS engine handles them), then
 * `.toISOString()` converts that instant to UTC. See `localDateAndHourToUtc`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DECISION 2 — 2-hour lead-time lockout.
 *
 * Tutoring requires ≥ 2 hours' notice, so any slot whose UTC instant is closer
 * than LEAD_TIME_HOURS to "now" is disabled in the picker. The check uses the
 * REAL wall-clock (`Date.now()`), not the mocked session data, so it always
 * reflects the actual current time regardless of when the demo is run. The
 * Cloud Function re-validates the same rule server-side (defense in depth) —
 * a client-side-only rule is trivially bypassed by calling the function
 * directly with a too-close slot.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Tutoring lead-time policy: a slot must be at least this many hours away. */
export const LEAD_TIME_HOURS = 2;

/** Minutes in the lead-time window. */
export const LEAD_TIME_MINUTES = LEAD_TIME_HOURS * 60;

/** The browser's IANA timezone id (e.g. "Asia/Kolkata", "America/New_York"). */
export function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** "UTC+5:30" / "UTC-4" style label for the LOCAL offset AT A GIVEN INSTANT. */
export function utcOffsetLabelAt(utcIso: string): string {
  const offsetMinutes = -new Date(utcIso).getTimezoneOffset(); // minutes east of UTC
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m > 0 ? ":" + String(m).padStart(2, "0") : ""}`;
}

/** Format a UTC instant for display in the parent's local timezone. */
export function formatLocalDateTime(utcIso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(utcIso));
}

/** Minutes from "now" until the given UTC instant (negative = in the past). */
export function minutesUntil(utcIso: string): number {
  return (new Date(utcIso).getTime() - Date.now()) / 60_000;
}

/**
 * Is this UTC instant inside the 2-hour lead-time window (or already past)?
 * Used to disable time slots in the picker and re-validated in the function.
 */
export function isWithinLeadTime(utcIso: string): boolean {
  return minutesUntil(utcIso) < LEAD_TIME_MINUTES;
}

/**
 * Build a UTC ISO string from LOCAL wall-clock parts (year, month 1-12, day,
 * hour, minute).
 *
 * `new Date(y, m-1, d, hour, min)` treats the parts as LOCAL time — exactly what
 * the parent meant when they picked them — and `.toISOString()` expresses that
 * instant in UTC before it is sent to the Cloud Function. This is the conversion
 * the assessment asks us to reason about: without it, the function would receive
 * an ambiguous "local-looking" string and could book the wrong absolute moment.
 */
export function localDateAndHourToUtc(dateStr: string, hour: number, minute = 0): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Defensive: a cleared/partial date input ("") must never become a bookable
  // slot — an invalid Date would make `.toISOString()` THROW a RangeError and
  // crash the picker. Callers treat the "" sentinel as "not a real slot".
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return "";
  }
  return new Date(y, m - 1, d, hour, minute, 0, 0).toISOString();
}

/**
 * "YYYY-MM-DD" of a Date in the browser's LOCAL timezone — the value format a
 * `<input type="date">` expects and the wall-clock key the slot grid operates on.
 */
export function toLocalDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
