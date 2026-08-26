/**
 * Calendar invitations, read out of the `text/calendar` part Gmail attaches to
 * them.
 *
 * An invite is not a fourth kind of mail — it belongs in whichever tier its
 * state puts it in, an unanswered RSVP being something that needs you and a
 * confirmed one being something that merely happened. What it does need is its
 * own card, and a card needs the four things a subject line never carries:
 * when it starts, how long it runs, where, and whether you have replied.
 */
export type InviteStatus =
  | "needs-action"
  | "accepted"
  | "declined"
  | "tentative"
  | "unknown";

export type Invite = {
  summary: string;
  /** ISO instant, or `YYYY-MM-DD` when the event is all-day. */
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  organizer: string;
  /** The reader's own reply, from their ATTENDEE line. */
  status: InviteStatus;
  /** A cancellation reads very differently from an invitation. */
  cancelled: boolean;
};

const STATUSES: Record<string, InviteStatus> = {
  "NEEDS-ACTION": "needs-action",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  TENTATIVE: "tentative",
};

type Line = { name: string; params: Record<string, string>; value: string };

/**
 * iCalendar folds long lines by breaking them and indenting the remainder with
 * a single space or tab, so unfolding has to happen before anything is parsed.
 */
function unfold(ics: string) {
  return ics.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "");
}

/** `DTSTART;TZID=Europe/London:20260828T100000` → name, params, value. */
function parseLine(raw: string): Line | null {
  const colon = raw.indexOf(":");
  if (colon < 0) return null;

  const [name, ...rest] = raw.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const part of rest) {
    const equals = part.indexOf("=");
    if (equals > 0) {
      params[part.slice(0, equals).toUpperCase()] = part
        .slice(equals + 1)
        .replace(/^"|"$/g, "");
    }
  }

  return {
    name: name.toUpperCase(),
    params,
    value: raw
      .slice(colon + 1)
      // Escapes defined by RFC 5545 for text values.
      .replace(/\\n/gi, " ")
      .replace(/\\([,;\\])/g, "$1")
      .trim(),
  };
}

/**
 * How far `timeZone` is from UTC at that instant, in milliseconds. Formatting
 * the instant *in* the zone and reading it back as if it were UTC is the only
 * way to ask this without shipping a timezone database.
 */
function zoneOffset(instant: number, timeZone: string) {
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

/**
 * Wall-clock time in a named zone → the instant it refers to. The first
 * correction is right everywhere except within an hour of a DST seam, where
 * the offset it used belonged to the wrong side of the jump; re-reading the
 * offset at the corrected instant settles those.
 */
function fromZone(utcGuess: number, timeZone: string) {
  try {
    const once = utcGuess - zoneOffset(utcGuess, timeZone);
    return utcGuess - zoneOffset(once, timeZone);
  } catch {
    return NaN; // an unknown TZID: the caller falls back to local time
  }
}

/**
 * An iCalendar date value in three flavours: a bare date, a floating local
 * time, and a UTC instant. Only the last one is unambiguous on its own, so a
 * TZID parameter decides the middle case and the server's own zone is the
 * fallback — the same assumption the rest of the app makes about "a day".
 */
function parseDate(line: Line) {
  const value = line.value;
  const date = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (date || line.params.VALUE === "DATE") {
    if (!date) return null;
    return { iso: `${date[1]}-${date[2]}-${date[3]}`, allDay: true };
  }

  const stamp = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!stamp) return null;

  const [, y, mo, d, h, mi, s, zulu] = stamp;
  const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);

  if (zulu) return { iso: new Date(asUtc).toISOString(), allDay: false };

  const zone = line.params.TZID;
  const zoned = zone ? fromZone(asUtc, zone) : NaN;
  if (!Number.isNaN(zoned)) {
    return { iso: new Date(zoned).toISOString(), allDay: false };
  }

  // No usable zone: read it as wall time where the app is running.
  const local = new Date(+y, +mo - 1, +d, +h, +mi, +s);
  return { iso: local.toISOString(), allDay: false };
}

/** The address inside `ATTENDEE;...:mailto:someone@example.com`. */
function addressOf(value: string) {
  return value.replace(/^mailto:/i, "").trim().toLowerCase();
}

/**
 * The VEVENT in a `text/calendar` part, as far as a digest cares about it.
 * `reader` is the connected mailbox, which is how we find the one ATTENDEE
 * line out of forty that says whether *you* have replied.
 */
export function parseInvite(ics: string, reader: string): Invite | null {
  const lines = unfold(ics)
    .split("\n")
    .map(parseLine)
    .filter((line): line is Line => line !== null);

  if (!lines.some((line) => line.name === "BEGIN" && line.value === "VEVENT")) {
    return null;
  }

  const first = (name: string) => lines.find((line) => line.name === name);
  const method = first("METHOD")?.value.toUpperCase() ?? "";
  const start = first("DTSTART") && parseDate(first("DTSTART")!);
  if (!start) return null;

  const endLine = first("DTEND");
  const end = endLine ? parseDate(endLine) : null;

  const me = reader.toLowerCase();
  const attendees = lines.filter((line) => line.name === "ATTENDEE");
  const mine =
    attendees.find((line) => addressOf(line.value) === me) ??
    // A mailing-list invite may not name the reader; a lone attendee is them.
    (attendees.length === 1 ? attendees[0] : undefined);

  const organizer = first("ORGANIZER");

  return {
    summary: first("SUMMARY")?.value ?? "",
    start: start.iso,
    end: end?.iso ?? start.iso,
    allDay: start.allDay,
    location: first("LOCATION")?.value ?? "",
    organizer: organizer?.params.CN ?? (organizer ? addressOf(organizer.value) : ""),
    status: mine ? (STATUSES[mine.params.PARTSTAT?.toUpperCase() ?? ""] ?? "unknown") : "unknown",
    cancelled:
      method === "CANCEL" || first("STATUS")?.value.toUpperCase() === "CANCELLED",
  };
}
