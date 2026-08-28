/**
 * Reading a wall clock in a named zone, without shipping a timezone database.
 *
 * The app's whole notion of "a day" depends on this: a digest for the 3rd is
 * the mail that arrived between two midnights *where the reader is*, which is
 * not where the server is.
 */

/** Milliseconds `timeZone` is ahead of UTC at `instant`. */
export function zoneOffset(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return (
    Date.UTC(
      read("year"),
      read("month") - 1,
      read("day"),
      read("hour") % 24,
      read("minute"),
      read("second"),
    ) - instant
  );
}

// The first correction is wrong only within an hour of a DST seam, where the
// offset belonged to the other side of the jump — so read it again and settle.
export function fromZone(utcGuess: number, timeZone: string) {
  try {
    const once = utcGuess - zoneOffset(utcGuess, timeZone);
    return utcGuess - zoneOffset(once, timeZone);
  } catch {
    return NaN; // an unknown zone: the caller falls back to local time
  }
}

/** Whether `Intl` recognises the zone, so a bad header cannot throw a 500. */
export function isTimeZone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Midnight starting `day`, in `timeZone` — or the server's own if unknown. */
function midnightOf(day: string, timeZone?: string) {
  const [y, m, d] = day.split("-").map(Number);

  if (timeZone) {
    const instant = fromZone(Date.UTC(y, m - 1, d), timeZone);
    if (!Number.isNaN(instant)) return instant;
  }
  return new Date(`${day}T00:00:00`).getTime();
}

/**
 * Midnight-to-midnight for `day` in `timeZone`, as epoch seconds — what Gmail's
 * `after:`/`before:` want. Without a zone this is the server's own midnight,
 * which on a UTC host files a reader's evening mail under tomorrow.
 */
export function dayBoundsIn(day: string, timeZone?: string) {
  const [y, m, d] = day.split("-").map(Number);
  // Step the calendar rather than adding 24h, which is wrong across a DST seam.
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);

  return {
    after: Math.floor(midnightOf(day, timeZone) / 1000),
    before: Math.floor(midnightOf(next, timeZone) / 1000),
  };
}

/** `YYYY-MM-DD` for right now in `timeZone`. */
export function todayIn(timeZone?: string) {
  const now = new Date();
  if (!timeZone) {
    const offset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
