/**
 * Date helpers shared by server and client, kept free of Node and Google
 * imports so client components do not drag `googleapis` into the bundle.
 * A "day" is always `YYYY-MM-DD` in the running machine's timezone.
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
 * Where the rail should start to show `day`: the window ending today if `day`
 * falls inside it, otherwise centred on `day` and pulled back from the future.
 * Only the date picker re-centres — stepping between pills leaves the rail
 * where it is, so the selection slides rather than the strip jumping.
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
 * The rail's pills, labels and all — a calendar question, so it needs no
 * network and renders immediately while only the volume pips wait. Called in
 * the browser for the live digest, so weekday names come out in the reader's
 * locale, and the window is passed in because the page owns it.
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
 * A date on a card, counted from the day on screen rather than from now, so
 * browsing back cannot turn last Tuesday's "tomorrow" into something overdue.
 * "by" is for deadlines and "on" for events — a meeting happens on the 28th,
 * it is not due by it.
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

/**
 * The reply-by tag: always "Reply by Aug 29", never "Reply tomorrow". One
 * shape means the date is in the same place on every card, and a date is
 * unambiguous where a relative word has to be resolved against the day on
 * screen rather than against today.
 */
export function replyBy(due: string, day: string) {
  if (!isValidDay(due)) return null;

  const stamp = new Date(`${due}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    // A year only earns its place when it isn't the one on screen.
    ...(due.slice(0, 4) === day.slice(0, 4) ? {} : { year: "numeric" }),
  });
  return `Reply by ${stamp}`;
}

/**
 * The clock to the nearest half hour — "10AM", "10:30AM", "11AM" — because a
 * card only has room to say roughly when, and "2:57 PM" spends the width of a
 * whole tag saying it precisely.
 */
export function roundedTime(at: string) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";

  // setMinutes(60) rolls the hour, which is what we want at :45 and later.
  date.setMinutes(Math.round(date.getMinutes() / 30) * 30, 0, 0);

  const parts = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const hour = get("hour");
  const minute = get("minute");
  const period = get("dayPeriod").toUpperCase().replace(/\s/g, "");

  // On a 24-hour clock there is no period to lean on, so the minutes stay.
  if (!period) return `${hour}:${minute}`;
  return minute === "00" ? `${hour}${period}` : `${hour}:${minute}${period}`;
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
