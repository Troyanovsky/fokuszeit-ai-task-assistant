/**
 * Date/time utilities for consistent handling of date-only and timestamp values.
 *
 * Responsibility:
 * - Treat date-only strings (`YYYY-MM-DD`) as local calendar dates (no timezone semantics).
 * - Treat timestamps as ISO 8601 strings in UTC (via `Date#toISOString()`), displaying in local time.
 *
 * Key rule: Never derive a date-only string via `toISOString().split('T')[0]` because it uses UTC and
 * can shift the calendar day for users in non-UTC timezones.
 */

/**
 * Format a Date as `YYYY-MM-DD` using local calendar values.
 * @param {Date} dateValue
 * @returns {string|null}
 */
export function formatDateOnlyLocal(dateValue) {
  if (!(dateValue instanceof Date) || isNaN(dateValue.getTime())) {
    return null;
  }
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  const day = String(dateValue.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Coerce a date-only value into a `YYYY-MM-DD` string representing a local calendar date.
 * Accepts `YYYY-MM-DD`, ISO strings with time, Date objects, and parseable date strings.
 * @param {string|Date|null|undefined} dateValue
 * @returns {string|null}
 */
export function coerceDateOnly(dateValue) {
  if (!dateValue) return null;

  if (dateValue instanceof Date) {
    return formatDateOnlyLocal(dateValue);
  }

  if (typeof dateValue !== 'string') {
    return null;
  }

  const trimmed = dateValue.trim();
  if (!trimmed) return null;

  const dateOnlyFromIso = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;

  // Normalize YYYY-M-D → YYYY-MM-DD
  const parts = dateOnlyFromIso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (parts) {
    const year = parts[1];
    const month = String(Number(parts[2])).padStart(2, '0');
    const day = String(Number(parts[3])).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fall back to Date parsing for inputs like "May 31, 2024"
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : formatDateOnlyLocal(parsed);
}

/**
 * Parse a date-only string (`YYYY-MM-DD`) into a Date at local midnight.
 * @param {string|null|undefined} dateString
 * @returns {Date|null}
 */
export function parseDateOnlyLocal(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  const coerced = coerceDateOnly(dateString);
  if (!coerced) return null;

  const match = coerced.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day);
}

/**
 * Create a Date for the local end-of-day for a given date-only value.
 * @param {string|Date|null|undefined} dateValue
 * @returns {Date|null}
 */
export function endOfDayLocalFromDateOnly(dateValue) {
  const dateOnly = coerceDateOnly(dateValue);
  if (!dateOnly) return null;
  const start = parseDateOnlyLocal(dateOnly);
  if (!start) return null;
  start.setHours(23, 59, 59, 999);
  return start;
}

/**
 * Get today's local calendar date as `YYYY-MM-DD`.
 * @returns {string}
 */
export function getTodayDateOnlyLocal() {
  return formatDateOnlyLocal(new Date());
}

