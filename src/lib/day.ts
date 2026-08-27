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

/** Days in the rail: today, and the six before it. */
export const RAIL_DAYS = 7;

const shift = (day: string, by: number) => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + by);
  return toDayString(d);
};

/** `length` consecutive days, the last of which is `end`. */
const endingOn = (end: string, length: number) =>
  Array.from({ length }, (_, index) => shift(end, index - (length - 1)));

/** The seven days starting at `anchor`. The rail is always exactly this. */
export function windowFrom(anchor: string) {
  return Array.from({ length: RAIL_DAYS }, (_, index) => shift(anchor, index));
}

/** The window that ends today — where the rail sits until you leave it. */
export function anchoredWindow(today = toDayString()) {
  return endingOn(today, RAIL_DAYS);
}

/**
 * Where the rail should start in order to show `day`.
 *
 * Two rules, and which one applies depends on how you got here:
 *
 * - If `day` is within the window ending today, that is the window. Positions
 *   then mean something — the same date is always in the same place.
 * - Otherwise the rail centres on `day`, three either side, pulled back if
 *   that would run past today.
 *
 * Centring is for arriving somewhere, not for moving around once you are
 * there. Only the date picker calls for it; stepping between pills keeps
 * whatever window it is already in, so the rail stays put and the selection
 * slides along it instead of the whole strip jumping under your finger.
 */
export function recentreAnchor(day: string, today = toDayString()) {
  const anchored = anchoredWindow(today);
  if (anchored.includes(day)) return anchored[0];

  const half = Math.floor(RAIL_DAYS / 2);
  const end = shift(day, half);
  return endingOn(end > today ? today : end, RAIL_DAYS)[0];
}


/** One pill in the rail. Everything here is calendar, not mailbox. */
export type RailDay = {
  day: string;
  weekday: string;
  date: string;
  selected: boolean;
  isToday: boolean;
};

/**
 * The rail's pills, labels and all.
 *
 * Which seven days these are, what they are called and which one is today are
 * questions a calendar answers on its own — no mailbox involved — so the rail
 * is built here and rendered immediately. Only the volume pips wait on the
 * network, and they are one 3px bar inside a pill that is already the right
 * size, so nothing moves when they land.
 *
 * Computed wherever it is called, which for the live digest is the browser:
 * the weekday names then come out in the reader's locale rather than the
 * server's. The window is passed in rather than derived, because which seven
 * days are on screen is a thing the page remembers, not a function of the
 * selection.
 */
export function railDays(
  window: string[],
  day: string,
  today = toDayString(),
): RailDay[] {
  return window.map((d) => {
    const date = new Date(`${d}T00:00:00`);
    return {
      day: d,
      weekday: date.toLocaleDateString(undefined, { weekday: "narrow" }),
      date: String(date.getDate()),
      selected: d === day,
      isToday: d === today,
    };
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
 * "by" is reserved for deadlines; an event gets "on". A meeting on the 28th is
 * not due by the 28th, it happens on it, and saying otherwise turns every
 * invitation into something that looks overdue. The two nearest days need no
 * preposition at all — "today" already says when.
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
    label: `${kind === "deadline" ? "by" : "on"} ${stamp}`,
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
