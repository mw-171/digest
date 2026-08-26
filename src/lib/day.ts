/**
 * Date helpers shared by server and client code. Kept free of any Node or
 * Google imports so client components can use them without dragging
 * `googleapis` into the browser bundle.
 *
 * A "day" is always a `YYYY-MM-DD` string in the timezone of whatever machine
 * is running the app.
 */

/** `YYYY-MM-DD` for the given date, in local time. */
export function toDayString(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function isValidDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00`))
  );
}

/** The seven days of the week `day` falls in, Monday first. */
export function weekOf(day: string) {
  const date = new Date(`${day}T00:00:00`);
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));

  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + index);
    return toDayString(d);
  });
}

/**
 * The seven-day window the strip shows. Centred on `day` where possible, but
 * never running past `today` — so landing on today gives a full week of
 * history rather than a row of empty future bars.
 */
export function weekWindow(day: string, today = toDayString()) {
  const centre = new Date(`${day}T00:00:00`);
  const start = new Date(centre);
  start.setDate(centre.getDate() - 3);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const lastAllowed = new Date(`${today}T00:00:00`);
  if (end > lastAllowed) {
    const overshoot = Math.round(
      (end.getTime() - lastAllowed.getTime()) / 86_400_000,
    );
    start.setDate(start.getDate() - overshoot);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    return toDayString(d);
  });
}

/** "20 Aug 2026" — what the header pill shows. */
export function formatPillDate(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDayTitle(day: string) {
  const date = new Date(`${day}T00:00:00`);
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: "long" }),
    dayOfMonth: date.toLocaleDateString(undefined, { day: "numeric" }),
    month: date.toLocaleDateString(undefined, { month: "long" }),
    full: date.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  };
}

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. */
export function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / DAY_MS,
  );
}

/**
 * A date on a card, read from the day you are looking at rather than from now.
 *
 * Browsing back a week must not turn last Tuesday's "tomorrow" into something
 * a week overdue, so everything here counts from `day` — the date on screen.
 * Only the two nearest days get a word; beyond that it is a real date, because
 * a bare weekday name ("Thu") is unreadable the moment the digest is not
 * today's.
 *
 * "by" is reserved for deadlines. A meeting on the 28th is not due by the
 * 28th, it happens on it, and saying otherwise turns every invitation into
 * something that looks overdue.
 */
export function formatDeadline(
  due: string,
  day: string,
  kind: "deadline" | "event" | "none" = "deadline",
) {
  if (!isValidDay(due) || kind === "none") return null;

  const offset = daysBetween(day, due);
  if (offset === 0) return { label: "today", late: false };
  if (offset === 1) return { label: "tomorrow", late: false };
  if (offset === -1) return { label: "yesterday", late: true };

  const date = new Date(`${due}T00:00:00`);
  const stamp = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    // A year only earns its place when it isn't the one on screen.
    ...(due.slice(0, 4) === day.slice(0, 4) ? {} : { year: "numeric" }),
  });

  return {
    label: kind === "deadline" && offset > 0 ? `by ${stamp}` : stamp,
    late: offset < 0,
  };
}

/** "Thu 28 Aug" / "Thu 28 Aug, 10:00" — the invite card's line. */
export function formatEventTime(start: string, allDay: boolean) {
  const date = new Date(allDay ? `${start}T00:00:00` : start);
  if (Number.isNaN(date.getTime())) return "";

  const stamp = date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (allDay) return `${stamp}, all day`;

  return `${stamp}, ${date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

/** The two lines of an invite's date block: "28" over "AUG". */
export function eventDateBlock(start: string, allDay: boolean) {
  const date = new Date(allDay ? `${start}T00:00:00` : start);
  if (Number.isNaN(date.getTime())) return { day: "", month: "" };

  return {
    day: date.toLocaleDateString(undefined, { day: "numeric" }),
    month: date.toLocaleDateString(undefined, { month: "short" }),
  };
}
