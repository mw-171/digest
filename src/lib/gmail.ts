import { google, type gmail_v1 } from "googleapis";
import {
  ownWriting,
  plainText,
  readableBody,
  type ReadableBody,
} from "@/lib/email-body";
import type { OAuthClient } from "@/lib/google";
import { parseInvite, type Invite } from "@/lib/invite";
import { dayBoundsIn } from "@/lib/timezone";

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

// Gmail's own sorting is free and already tuned to this mailbox, so these keep
// their label's category and no body is ever downloaded.
export const BULK_CATEGORIES: GmailCategory[] = ["promotions", "social", "forums"];

// No CATEGORY_* label means tabs are off, which reads as personal.
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
  /** Sent by a machine, so nothing is waiting on a reply. */
  automated: boolean;
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

// Signal is capped low: each costs a full `messages.get` and model context.
const SIGNAL_MAX = 50;
const BULK_MAX = 120;
const VOLUME_MAX = 100;
const CONCURRENCY = 12;

/** Enough of a body for the model to see what the message is about. */
const BODY_EXCERPT = 4000;


/**
 * Midnight-to-midnight bounds as epoch seconds, which sidesteps the timezone
 * guessing `after:2026/08/24` invites. Bounds are local to the server.
 */


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
  timeZone?: string,
) {
  const { after, before } = dayBoundsIn(day, timeZone);
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

/** Mailbox names that never read what you send back. */
const AUTOMATED_SENDER =
  /^(no-?reply|do-?not-?reply|notifications?|alerts?|support|billing|receipts?)@/i;

/** Gmail's own tabs for mail that arrives rather than is written to you. */
const AUTOMATED_LABELS = ["CATEGORY_PROMOTIONS", "CATEGORY_UPDATES"];

// Eager on purpose: a false "needs reply" costs a look on every scan.
function isAutomated(data: gmail_v1.Schema$Message, fromEmail: string) {
  if (AUTOMATED_SENDER.test(fromEmail)) return true;
  // Anything offering an unsubscribe is a broadcast, not a correspondent.
  if (header(data, "List-Unsubscribe")) return true;

  const auto = header(data, "Auto-Submitted").trim().toLowerCase();
  if (auto && auto !== "no") return true;

  const labels = data.labelIds ?? [];
  return AUTOMATED_LABELS.some((label) => labels.includes(label));
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
    automated: isAutomated(data, fromEmail),
    labels: data.labelIds ?? [],
    tab: categoryOf(data.labelIds ?? []),
    invite: null,
  };
}

const byNewest = (a: DigestMessage, b: DigestMessage) =>
  b.receivedAt.localeCompare(a.receivedAt);

// Split on Gmail's labels: bulk keeps headers only, signal is read in full.
// `reader` matches your own ATTENDEE line on an invite.
export async function fetchDay(
  auth: OAuthClient,
  day: string,
  {
    reader = "",
    timeZone,
    max = SIGNAL_MAX,
    bulkMax = BULK_MAX,
  }: {
    reader?: string;
    /** The reader's IANA zone. A day is their midnight-to-midnight, not ours. */
    timeZone?: string;
    max?: number;
    bulkMax?: number;
  } = {},
): Promise<DayMail> {
  const gmail = google.gmail({ version: "v1", auth });

  const [signalIds, bulkIds] = await Promise.all([
    listMessageIds(gmail, day, max, SIGNAL_FILTER, timeZone),
    listMessageIds(gmail, day, bulkMax, BULK_FILTER, timeZone),
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
        metadataHeaders: [
          "From",
          "Subject",
          "Date",
          "List-Unsubscribe",
          "Auto-Submitted",
        ],
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
 * How much mail arrived on each of `days` — ids only, since the rail needs a
 * count and nothing else. Bulk is left out: forty promotions are not a busy day.
 */
export async function fetchVolumes(
  auth: OAuthClient,
  days: string[],
  { max = VOLUME_MAX, timeZone }: { max?: number; timeZone?: string } = {},
): Promise<DayVolume[]> {
  const gmail = google.gmail({ version: "v1", auth });

  return mapWithLimit(days, CONCURRENCY, async (day) => {
    const { ids, truncated } = await listMessageIds(
      gmail,
      day,
      max,
      SIGNAL_FILTER,
      timeZone,
    );
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

// Decoded from transfer encoding but still in the sender's charset — reading
// Windows-1252 as UTF-8 is where stray mojibake comes from.
function decodePart(part: gmail_v1.Schema$MessagePart) {
  if (!part.body?.data) return "";
  const type = part.headers?.find((h) => h.name?.toLowerCase() === "content-type");
  const charset = type?.value?.match(/charset\s*=\s*"?([\w-]+)"?/i)?.[1]?.toLowerCase();
  const encoding = (charset && CHARSETS[charset]) || "utf8";
  return Buffer.from(part.body.data, "base64url").toString(encoding);
}

// Attachments are skipped — an attached .txt is not the message — but an
// invite often arrives as `invite.ics`, so `attachments` opts back in.
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

// Memoised against the refresh token: the answer cannot change while it does not.
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

/** One email you wrote, cut back to the words you typed. */
export type SentMessage = {
  id: string;
  threadId: string;
  subject: string;
  /** The first recipient's display name, or their address. */
  toName: string;
  toEmail: string;
  /** How many people it went to, To and Cc together. */
  recipients: number;
  sentAt: string; // ISO
  /** Written into a thread rather than starting one. */
  isReply: boolean;
  /** What you typed. The quoted thread and the signature are already gone. */
  text: string;
};

/** Enough of your own mail to hear a voice in, and not so much it costs a lot. */
export const SENT_MAX = 50;

/** Per message, which is plenty: a voice shows in the first few paragraphs. */
const SENT_EXCERPT = 2500;

/** Anything shorter is "thanks!" — true, but it teaches nothing. */
const SENT_MIN_CHARS = 40;

/** The newest `max` ids matching `q`, newest first — Gmail's own order. */
async function listRecentIds(gmail: gmail_v1.Gmail, q: string, max: number) {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const { data } = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: Math.min(500, max - ids.length),
      pageToken,
    });

    for (const message of data.messages ?? []) {
      if (message.id) ids.push(message.id);
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken && ids.length < max);

  return ids.slice(0, max);
}

/** Every address in a recipient header — the only reliable way to count them. */
const ADDRESSES = /[^\s<>,"]+@[^\s<>,"]+/g;

// Splitting on the comma is wrong the moment a display name has one in it
// (`"Wu, Megan" <m@example.com>`), so an angled address ends the first entry.
function firstRecipient(value: string) {
  const angled = value.indexOf(">");
  return angled === -1 ? (value.split(",")[0] ?? "") : value.slice(0, angled + 1);
}

/**
 * Your own recent mail, newest first. Unlike the digest this reads across days
 * rather than inside one: it is a sample of how you write, not a record of what
 * happened. Drafts and chats are left out, and so is anything too short to
 * carry a voice.
 */
export async function fetchSent(
  auth: OAuthClient,
  { max = SENT_MAX }: { max?: number } = {},
): Promise<SentMessage[]> {
  const gmail = google.gmail({ version: "v1", auth });
  // `in:sent` rather than the SENT label, so a thread you were also copied on
  // still contributes only the parts you wrote.
  const ids = await listRecentIds(gmail, "in:sent -in:chats -in:drafts", max);

  const messages = await mapWithLimit(ids, CONCURRENCY, async (id) => {
    const { data } = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full", // the body is the whole point
    });

    const payload = data.payload ?? undefined;
    const body = payload
      ? readableBody(findPart(payload, "text/html"), findPart(payload, "text/plain"))
      : null;

    const to = header(data, "To");
    const { from: toName, fromEmail: toEmail } = parseFrom(firstRecipient(to));
    const recipients = `${to} ${header(data, "Cc")}`.match(ADDRESSES)?.length ?? 0;

    return {
      id: data.id ?? id,
      threadId: data.threadId ?? "",
      subject: header(data, "Subject") || "(no subject)",
      toName,
      toEmail,
      recipients,
      sentAt: new Date(Number(data.internalDate ?? 0)).toISOString(),
      isReply:
        Boolean(header(data, "In-Reply-To")) ||
        /^\s*re:/i.test(header(data, "Subject")),
      text: ownWriting(body ? plainText(body.blocks) : "").slice(0, SENT_EXCERPT),
    } satisfies SentMessage;
  });

  return messages.filter((message) => message.text.length >= SENT_MIN_CHARS);
}
