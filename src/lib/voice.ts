import { createHash } from "node:crypto";
import { cache } from "react";

import { readCache, writeCache } from "@/lib/ai-cache";
import { fetchAccountEmail, fetchSent, SENT_MAX, type SentMessage } from "@/lib/gmail";
import { authorizedClient } from "@/lib/google";
import {
  analyzeVoice,
  EMPTY_PROFILE,
  PROMPT_VERSION,
  type VoiceProfile,
} from "@/lib/voice-ai";

/** One correspondent, and how much of the sample went to them. */
export type Recipient = { name: string; email: string; count: number };

/** What the sample was, counted rather than read. Free, and it never lies. */
export type VoiceStats = {
  /** How many sent emails the voice was read from. */
  analyzed: number;
  /** The span the sample covers, oldest and newest, as `YYYY-MM-DD`. */
  from: string;
  to: string;
  /** The middle length in words. A mean is dragged around by one long email. */
  medianWords: number;
  /** The share of the sample that answered a thread rather than starting one. */
  replyShare: number;
  topRecipients: Recipient[];
};

/** One email from the sample, named so the page can show its own evidence. */
export type SentSample = {
  id: string;
  threadId: string;
  subject: string;
  toName: string;
  sentAt: string;
  words: number;
};

export type Voice = {
  stats: VoiceStats;
  profile: VoiceProfile;
  /** The most recent few, as the page's receipt for what it read. */
  recent: SentSample[];
  /** The connected address, which Gmail deep links need. */
  account: string;
};

export const SAMPLE_SIZE = SENT_MAX;

/** How many of the sample the page lists back. */
const SHOWN = 6;

const RECIPIENTS_SHOWN = 4;

const wordsIn = (text: string) => text.split(/\s+/).filter(Boolean).length;

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function topRecipients(messages: SentMessage[]): Recipient[] {
  const counts = new Map<string, Recipient>();

  for (const message of messages) {
    if (!message.toEmail) continue;
    const key = message.toEmail.toLowerCase();
    const found = counts.get(key);
    if (found) found.count += 1;
    else
      counts.set(key, {
        name: message.toName || message.toEmail,
        email: message.toEmail,
        count: 1,
      });
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, RECIPIENTS_SHOWN);
}

const EMPTY_STATS: VoiceStats = {
  analyzed: 0,
  from: "",
  to: "",
  medianWords: 0,
  replyShare: 0,
  topRecipients: [],
};

/** Everything a draft needs to sound like you, and nothing it does not. */
export type DraftingVoice = {
  profile: VoiceProfile;
  /** What length reads as normal from you. A draft three times this is not yours. */
  medianWords: number;
};

/**
 * The last voice that was read, kept beside the day files so writing a draft
 * does not re-sweep the mailbox. Keyed on the account, because the cache
 * directory is one directory and an address is the only thing that separates
 * two of them.
 */
const rememberedFile = (account: string) =>
  `voice-profile-${PROMPT_VERSION}-${createHash("sha1").update(account).digest("hex").slice(0, 16)}.json`;

/**
 * How you write, ready to write in. The read one when the drafts tab has been
 * opened before, else read now — a draft is worth the sweep, and after the
 * first one it is remembered.
 */
export const voiceForDrafting = cache(
  async (account: string): Promise<DraftingVoice> => {
    const remembered = account
      ? await readCache<DraftingVoice>(rememberedFile(account))
      : null;
    if (remembered?.profile.summary.length) return remembered;

    const voice = await getVoice();
    return { profile: voice.profile, medianWords: voice.stats.medianWords };
  },
);

/**
 * How you write, read off the last `max` emails you sent. The counted half is
 * always honest; the read half is Claude's, cached on disk against the exact
 * message ids, so opening this page twice costs one call.
 */
export const getVoice = cache(async (max = SAMPLE_SIZE): Promise<Voice> => {
  const auth = await authorizedClient();
  if (!auth) throw new Error("Not connected to Gmail.");

  const [account, messages] = await Promise.all([
    fetchAccountEmail(auth).catch(() => ""),
    fetchSent(auth, { max }),
  ]);

  if (messages.length === 0) {
    return { stats: EMPTY_STATS, profile: EMPTY_PROFILE, recent: [], account };
  }

  // Newest first out of Gmail, so the ends of the array are the ends of the span.
  const dates = messages.map((message) => message.sentAt).sort();
  const profile = await analyzeVoice(messages);
  const medianWords = median(messages.map((message) => wordsIn(message.text)));

  // Kept for the drafting path, which needs the voice and not the mailbox.
  if (profile.source === "claude" && account) {
    await writeCache(rememberedFile(account), { profile, medianWords });
  }

  return {
    stats: {
      analyzed: messages.length,
      from: dates[0].slice(0, 10),
      to: dates[dates.length - 1].slice(0, 10),
      medianWords,
      replyShare:
        messages.filter((message) => message.isReply).length / messages.length,
      topRecipients: topRecipients(messages),
    },
    profile,
    recent: messages.slice(0, SHOWN).map((message) => ({
      id: message.id,
      threadId: message.threadId,
      subject: message.subject,
      toName: message.toName,
      sentAt: message.sentAt,
      words: wordsIn(message.text),
    })),
    account,
  };
});
