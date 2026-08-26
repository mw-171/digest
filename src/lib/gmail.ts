import { google, type gmail_v1 } from "googleapis";
import { readableBody, type ReadableBody } from "@/lib/email-body";
import type { OAuthClient } from "@/lib/google";

/** Gmail's own tab categories, from the CATEGORY_* system labels. */
export const CATEGORIES = [
  "personal",
  "updates",
  "promotions",
  "social",
  "forums",
] as const;
export type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<string, Category> = {
  CATEGORY_PERSONAL: "personal",
  CATEGORY_UPDATES: "updates",
  CATEGORY_PROMOTIONS: "promotions",
  CATEGORY_SOCIAL: "social",
  CATEGORY_FORUMS: "forums",
};

/** Bulk mail: never correspondence, so it stays out of the digest by default. */
export const BULK_CATEGORIES: Category[] = ["promotions", "social", "forums"];

export function isBulk(category: Category) {
  return BULK_CATEGORIES.includes(category);
}

/**
 * A message carries at most one CATEGORY_* label. Mail has none when the
 * account has tabs switched off, which reads as personal — the right default,
 * since that account isn't sorting bulk mail away either.
 */
export function categoryOf(labels: string[]): Category {
  for (const label of labels) {
    const category = CATEGORY_LABELS[label];
    if (category) return category;
  }
  return "personal";
}

/** Gmail query fragment that drops bulk mail before it is ever fetched. */
const WITHOUT_BULK = BULK_CATEGORIES.map((c) => `-category:${c}`).join(" ");

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
  category: Category;
};

export type Digest = {
  day: string;
  messages: DigestMessage[];
  /** True when the day had more messages than `max`. */
  truncated: boolean;
  /** Bulk messages left out of the fetch entirely. */
  hiddenBulk: number;
};

const MAX_MESSAGES = 100;
const CONCURRENCY = 8;


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

export async function fetchDigest(
  auth: OAuthClient,
  day: string,
  {
    max = MAX_MESSAGES,
    includeBulk = false,
  }: { max?: number; includeBulk?: boolean } = {},
): Promise<Digest> {
  const gmail = google.gmail({ version: "v1", auth });

  // Excluding bulk in the query rather than after the fetch means promotions
  // can't eat the message cap, and none of them cost a messages.get.
  const [{ ids, truncated }, hiddenBulk] = await Promise.all([
    listMessageIds(gmail, day, max, includeBulk ? "" : WITHOUT_BULK),
    includeBulk ? Promise.resolve(0) : countBulk(gmail, day, max),
  ]);

  const messages = await mapWithLimit(ids, CONCURRENCY, async (id) => {
    const { data } = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "metadata", // headers + snippet only; no bodies to download
      metadataHeaders: ["From", "Subject", "Date"],
    });

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
      category: categoryOf(data.labelIds ?? []),
    } satisfies DigestMessage;
  });

  messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return { day, messages, truncated, hiddenBulk };
}


export type DayVolume = { day: string; count: number; truncated: boolean };

/**
 * How much mail arrived on each of `days`. Used for the week's volume bars, so
 * a count is all we need — this lists ids without fetching any message.
 */
export async function fetchVolumes(
  auth: OAuthClient,
  days: string[],
  {
    max = MAX_MESSAGES,
    includeBulk = false,
  }: { max?: number; includeBulk?: boolean } = {},
): Promise<DayVolume[]> {
  const gmail = google.gmail({ version: "v1", auth });
  const filter = includeBulk ? "" : WITHOUT_BULK;

  return mapWithLimit(days, CONCURRENCY, async (day) => {
    const { ids, truncated } = await listMessageIds(gmail, day, max, filter);
    return { day, count: ids.length, truncated };
  });
}

/** How much bulk mail the day holds — ids only, so it costs one list call. */
async function countBulk(gmail: gmail_v1.Gmail, day: string, max: number) {
  // Braces are Gmail's OR group. A bare `OR` would bind to the neighbouring
  // terms instead and take the date range with it.
  const filter = BULK_CATEGORIES.map((c) => `category:${c}`).join(" ");
  const { ids } = await listMessageIds(gmail, day, max, `{${filter}}`);
  return ids.length;
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
 * skipped even when they are text — an attached .txt is not the message.
 */
function findPart(part: gmail_v1.Schema$MessagePart, wanted: string): string {
  const disposition = part.headers
    ?.find((h) => h.name?.toLowerCase() === "content-disposition")
    ?.value?.toLowerCase();
  if (disposition?.startsWith("attachment")) return "";

  if (part.mimeType === wanted && part.body?.data) return decodePart(part);
  for (const child of part.parts ?? []) {
    const found = findPart(child, wanted);
    if (found) return found;
  }
  return "";
}

/** One message with its body, for the detail view. */
export async function fetchMessage(
  auth: OAuthClient,
  id: string,
): Promise<FullMessage> {
  const gmail = google.gmail({ version: "v1", auth });
  const { data } = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });

  const payload = data.payload ?? undefined;
  const { from, fromEmail } = parseFrom(header(data, "From"));

  // Both alternatives, then one readable rendition of whichever is better.
  const body = payload
    ? readableBody(findPart(payload, "text/html"), findPart(payload, "text/plain"))
    : { blocks: [], truncated: false, source: "none" as const };

  return {
    id: data.id ?? id,
    threadId: data.threadId ?? "",
    from,
    fromEmail,
    to: header(data, "To"),
    subject: header(data, "Subject") || "(no subject)",
    snippet: data.snippet ?? "",
    receivedAt: new Date(Number(data.internalDate ?? 0)).toISOString(),
    unread: data.labelIds?.includes("UNREAD") ?? false,
    labels: data.labelIds ?? [],
    category: categoryOf(data.labelIds ?? []),
    body,
  };
}

/** The address of the connected mailbox, for account-correct Gmail links. */
export async function fetchAccountEmail(auth: OAuthClient) {
  const gmail = google.gmail({ version: "v1", auth });
  const { data } = await gmail.users.getProfile({ userId: "me" });
  return data.emailAddress ?? "";
}

/**
 * A link that opens the real thing. Gmail accepts an address where the `u/0`
 * account index normally goes, which is what makes this land in the right
 * mailbox for someone signed into several — and on a phone the same URL hands
 * off to the Gmail app rather than the mobile web view.
 */
export function gmailThreadUrl(threadId: string, account: string) {
  const who = account ? encodeURIComponent(account) : "0";
  return `https://mail.google.com/mail/u/${who}/#all/${threadId}`;
}
