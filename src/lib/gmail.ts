import { google, type gmail_v1 } from "googleapis";
import { plainText, readableBody, type ReadableBody } from "@/lib/email-body";
import type { OAuthClient } from "@/lib/google";
import { parseInvite, type Invite } from "@/lib/invite";

/** Gmail's own tab categories, from the CATEGORY_* system labels. */
export const GMAIL_CATEGORIES = [
  "personal",
  "updates",
  "promotions",
  "social",
  "forums",
] as const;
export type GmailCategory = (typeof GMAIL_CATEGORIES)[number];

const CATEGORY_LABELS: Record<string, GmailCategory> = {
  CATEGORY_PERSONAL: "personal",
  CATEGORY_UPDATES: "updates",
  CATEGORY_PROMOTIONS: "promotions",
  CATEGORY_SOCIAL: "social",
  CATEGORY_FORUMS: "forums",
};

/**
 * Bulk mail, decided by Gmail rather than by us. Promotions, social and forums
 * are advertising and mailing lists by definition, and Gmail's own sorting is
 * free, instant and already tuned to this mailbox — so these keep the category
 * their label gave them and no body is ever downloaded for them.
 */
export const BULK_CATEGORIES: GmailCategory[] = ["promotions", "social", "forums"];

/**
 * A message carries at most one CATEGORY_* label. Mail has none when the
 * account has tabs switched off, which reads as personal — the right default,
 * since that account isn't sorting bulk mail away either.
 */
export function categoryOf(labels: string[]): GmailCategory {
  for (const label of labels) {
    const category = CATEGORY_LABELS[label];
    if (category) return category;
  }
  return "personal";
}

/** Everything that is not bulk mail. Braces are Gmail's OR group. */
const SIGNAL_FILTER = BULK_CATEGORIES.map((c) => `-category:${c}`).join(" ");
const BULK_FILTER = `{${BULK_CATEGORIES.map((c) => `category:${c}`).join(" ")}}`;

export type DigestMessage = {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  receivedAt: string; // ISO
  unread: boolean;
  labels: string[];
  /** Which of Gmail's own tabs the message landed in. */
  tab: GmailCategory;
  /** Set when the message carries a calendar invitation. */
  invite: Invite | null;
};

/** A signal message, read in full — `text` is what the model is given. */
export type SignalMessage = DigestMessage & { text: string };

export type DayMail = {
  day: string;
  /** Read in full and triaged. */
  signal: SignalMessage[];
  /** Headers only. The body is never downloaded and never read. */
  bulk: DigestMessage[];
  /** True when the day held more signal than `max`. */
  truncated: boolean;
};

/**
 * How much of a day we read. Signal is capped low because each one costs a
 * full `messages.get` *and* a slice of the model's context; one heavy day
 * should not be able to blow up the digest's latency.
 */
const SIGNAL_MAX = 50;
const BULK_MAX = 120;
const VOLUME_MAX = 100;
const CONCURRENCY = 12;

/** Enough of a body for the model to see what the message is about. */
const BODY_EXCERPT = 4000;


/**
 * Midnight-to-midnight bounds as epoch seconds. Gmail's `after:`/`before:`
 * accept epochs, which sidesteps the timezone guessing that `after:2026/08/24`
 * does. Bounds are local to the machine running the server.
 */
function dayBounds(day: string) {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    after: Math.floor(start.getTime() / 1000),
    before: Math.floor(end.getTime() / 1000),
  };
}

function header(message: gmail_v1.Schema$Message, name: string) {
  const headers = message.payload?.headers ?? [];
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** `"Ada Lovelace" <ada@example.com>` -> display name + address. */
function parseFrom(value: string) {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) return { from: value.trim(), fromEmail: value.trim() };
  const name = match[1].replace(/^"|"$/g, "").trim();
  const email = match[2].trim();
  return { from: name || email, fromEmail: email };
}

/** Run `task` over `items`, at most `limit` in flight, preserving order. */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

/** Every message id received on `day`, up to `max`. */
async function listMessageIds(
  gmail: gmail_v1.Gmail,
  day: string,
  max: number,
  filter = "",
) {
  const { after, before } = dayBounds(day);
  const q = `after:${after} before:${before} -in:chats ${filter}`.trim();

  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const { data } = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: Math.min(500, max - ids.length + 1),
      pageToken,
    });

    for (const message of data.messages ?? []) {
      if (message.id) ids.push(message.id);
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken && ids.length <= max);

  return { ids: ids.slice(0, max), truncated: ids.length > max };
}

/** Headers and snippet, with no body downloaded. What bulk mail gets. */
function headline(data: gmail_v1.Schema$Message, id: string): DigestMessage {
  const { from, fromEmail } = parseFrom(header(data, "From"));
  return {
    id: data.id ?? id,
    threadId: data.threadId ?? "",
    from,
    fromEmail,
    subject: header(data, "Subject") || "(no subject)",
    snippet: data.snippet ?? "",
    receivedAt: new Date(Number(data.internalDate ?? 0)).toISOString(),
    unread: data.labelIds?.includes("UNREAD") ?? false,
    labels: data.labelIds ?? [],
    tab: categoryOf(data.labelIds ?? []),
    invite: null,
  };
}

const byNewest = (a: DigestMessage, b: DigestMessage) =>
  b.receivedAt.localeCompare(a.receivedAt);

/**
 * One day of mail, already split.
 *
 * The split happens at fetch time and on Gmail's own labels, which is what
 * makes the cheap half cheap: bulk mail is two hundred bytes of headers each
 * and its body is never downloaded. Only signal is read in full, and only
 * signal has its category decided by the model.
 *
 * `reader` is the connected address — the one an invite's ATTENDEE lines are
 * matched against to find out whether *you* have replied.
 */
export async function fetchDay(
  auth: OAuthClient,
  day: string,
  {
    reader = "",
    max = SIGNAL_MAX,
    bulkMax = BULK_MAX,
  }: { reader?: string; max?: number; bulkMax?: number } = {},
): Promise<DayMail> {
  const gmail = google.gmail({ version: "v1", auth });

  const [signalIds, bulkIds] = await Promise.all([
    listMessageIds(gmail, day, max, SIGNAL_FILTER),
    listMessageIds(gmail, day, bulkMax, BULK_FILTER),
  ]);

  const [signal, bulk] = await Promise.all([
    mapWithLimit(signalIds.ids, CONCURRENCY, async (id) => {
      const { data } = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full", // the body is the whole point of the signal half
      });

      const payload = data.payload ?? undefined;
      const body = payload
        ? readableBody(findPart(payload, "text/html"), findPart(payload, "text/plain"))
        : null;
      const ics = payload ? findPart(payload, "text/calendar", true) : "";

      return {
        ...headline(data, id),
        invite: ics ? parseInvite(ics, reader) : null,
        text: (body ? plainText(body.blocks) : data.snippet ?? "").slice(
          0,
          BODY_EXCERPT,
        ),
      } satisfies SignalMessage;
    }),

    mapWithLimit(bulkIds.ids, CONCURRENCY, async (id) => {
      const { data } = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata", // headers + snippet only; no bodies to download
        metadataHeaders: ["From", "Subject", "Date"],
      });
      return headline(data, id);
    }),
  ]);

  signal.sort(byNewest);
  bulk.sort(byNewest);
  return { day, signal, bulk, truncated: signalIds.truncated };
}

export type DayVolume = { day: string; count: number; truncated: boolean };

/**
 * How much mail arrived on each of `days`. Used for the week's volume bars, so
 * a count is all we need — this lists ids without fetching any message. Bulk
 * is left out: the rail is meant to show how busy a day was, and forty
 * promotions do not make a busy day.
 */
export async function fetchVolumes(
  auth: OAuthClient,
  days: string[],
  { max = VOLUME_MAX }: { max?: number } = {},
): Promise<DayVolume[]> {
  const gmail = google.gmail({ version: "v1", auth });

  return mapWithLimit(days, CONCURRENCY, async (day) => {
    const { ids, truncated } = await listMessageIds(gmail, day, max, SIGNAL_FILTER);
    return { day, count: ids.length, truncated };
  });
}

export type FullMessage = DigestMessage & {
  to: string;
  body: ReadableBody;
};

/** The charsets worth honouring; anything else is close enough to UTF-8. */
const CHARSETS: Record<string, BufferEncoding> = {
  "utf-8": "utf8",
  "utf8": "utf8",
  "us-ascii": "ascii",
  "iso-8859-1": "latin1",
  "iso-8859-15": "latin1",
  "windows-1252": "latin1",
  "utf-16": "utf16le",
  "utf-16le": "utf16le",
};

/**
 * Gmail hands the part back already decoded from its transfer encoding, but
 * still in the sender's charset. Reading a Windows-1252 newsletter as UTF-8 is
 * where stray "\u00e2\u20ac\u2122" sequences in a body come from.
 */
function decodePart(part: gmail_v1.Schema$MessagePart) {
  if (!part.body?.data) return "";
  const type = part.headers?.find((h) => h.name?.toLowerCase() === "content-type");
  const charset = type?.value?.match(/charset\s*=\s*"?([\w-]+)"?/i)?.[1]?.toLowerCase();
  const encoding = (charset && CHARSETS[charset]) || "utf8";
  return Buffer.from(part.body.data, "base64url").toString(encoding);
}

/**
 * The first part of type `wanted` that is actual body text. Attachments are
 * skipped even when they are text — an attached .txt is not the message — but
 * an invite is often attached as `invite.ics`, so `attachments` opts back in.
 */
function findPart(
  part: gmail_v1.Schema$MessagePart,
  wanted: string,
  attachments = false,
): string {
  const disposition = part.headers
    ?.find((h) => h.name?.toLowerCase() === "content-disposition")
    ?.value?.toLowerCase();
  if (!attachments && disposition?.startsWith("attachment")) return "";

  if (part.mimeType === wanted && part.body?.data) return decodePart(part);
  for (const child of part.parts ?? []) {
    const found = findPart(child, wanted, attachments);
    if (found) return found;
  }
  return "";
}

/** One message with its body, for the detail view. */
export async function fetchMessage(
  auth: OAuthClient,
  id: string,
  reader = "",
): Promise<FullMessage> {
  const gmail = google.gmail({ version: "v1", auth });
  const { data } = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });

  const payload = data.payload ?? undefined;

  // Both alternatives, then one readable rendition of whichever is better.
  const body = payload
    ? readableBody(findPart(payload, "text/html"), findPart(payload, "text/plain"))
    : { blocks: [], truncated: false, source: "none" as const };
  const ics = payload ? findPart(payload, "text/calendar", true) : "";

  return {
    ...headline(data, id),
    to: header(data, "To"),
    invite: ics ? parseInvite(ics, reader) : null,
    body,
  };
}

/**
 * The address of the connected mailbox — for account-correct Gmail links, and
 * for matching your own ATTENDEE line on an invitation.
 *
 * Memoised against the refresh token, because the answer cannot change while
 * that token does not, and this would otherwise cost a round trip on the way
 * to rendering every digest and every message.
 */
const accountEmails = new Map<string, string>();

export async function fetchAccountEmail(auth: OAuthClient) {
  const token = auth.credentials.refresh_token ?? "";
  const known = accountEmails.get(token);
  if (known) return known;

  const gmail = google.gmail({ version: "v1", auth });
  const { data } = await gmail.users.getProfile({ userId: "me" });
  const email = data.emailAddress ?? "";
  if (email) accountEmails.set(token, email);
  return email;
}
