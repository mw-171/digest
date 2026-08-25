import { google, type gmail_v1 } from "googleapis";
import type { OAuthClient } from "@/lib/google";

export type DigestMessage = {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  receivedAt: string; // ISO
  unread: boolean;
};

export type Digest = {
  day: string;
  messages: DigestMessage[];
  /** True when the day had more messages than `max`. */
  truncated: boolean;
};

const MAX_MESSAGES = 100;
const CONCURRENCY = 8;

/** `YYYY-MM-DD` for the given date in the *server's* timezone. */
export function toDayString(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function isValidDay(day: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00`));
}

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
async function listMessageIds(gmail: gmail_v1.Gmail, day: string, max: number) {
  const { after, before } = dayBounds(day);
  const q = `after:${after} before:${before} -in:chats`;

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
  { max = MAX_MESSAGES }: { max?: number } = {},
): Promise<Digest> {
  const gmail = google.gmail({ version: "v1", auth });
  const { ids, truncated } = await listMessageIds(gmail, day, max);

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
    } satisfies DigestMessage;
  });

  messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return { day, messages, truncated };
}
