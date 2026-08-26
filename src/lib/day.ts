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
