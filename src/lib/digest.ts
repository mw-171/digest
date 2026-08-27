import { cache } from "react";

import { toDayString, windowFrom } from "@/lib/day";
import {
  CATEGORIES,
  fetchInsights,
  URGENCY_RANK,
  type Category,
  type Insight,
} from "@/lib/digest-ai";
import {
  fetchAccountEmail,
  fetchDay,
  fetchVolumes,
  type DigestMessage,
} from "@/lib/gmail";
import { authorizedClient } from "@/lib/google";

export type DigestItem = DigestMessage & Insight;

/** One tile: what the category is called, and how much is in it. */
export type CategoryGroup = {
  key: Category;
  title: string;
  count: number;
  /** How many of those want something back from the reader. */
  replies: number;
};

export type WeekDay = {
  day: string;
  weekday: string;
  date: string;
  count: number;
  /** How busy the day was, 0–1, against the busiest day in the window. */
  weight: number;
  selected: boolean;
  isToday: boolean;
};

/** Everything about one day except its week context. */
export type DayDigest = {
  day: string;
  recap: string;
  source: "claude" | "heuristic";
  /** Every message the day held, both halves. */
  total: number;
  truncated: boolean;
  /** The four tiles, always all four, in a fixed order. */
  categories: CategoryGroup[];
  /** Every message, already sorted by how much it wants the reader. */
  items: DigestItem[];
};

export type Digest = DayDigest & { week: WeekDay[] };

export const CATEGORY_TITLES: Record<Category, string> = {
  work: "Work",
  meetings: "Meetings",
  social: "Social",
  updates: "Updates",
};

async function client() {
  const auth = await authorizedClient();
  if (!auth) throw new Error("Not connected to Gmail.");
  return auth;
}

/**
 * Volumes for the seven days starting at `start`.
 *
 * Separate from {@link getDay} — and much faster, since it only counts ids —
 * so the rail can render while the day is still being triaged. Which seven
 * days those are is the caller's decision: the rail is a thing the page moves
 * around, not something derivable from the day being read.
 *
 * `selected` is left false here; only the page knows what is selected.
 *
 * `cache` dedupes within a render, so several components may call these freely.
 */
export const getWeek = cache(async (start: string): Promise<WeekDay[]> => {
  const today = toDayString();
  const days = windowFrom(start);
  const volumes = await fetchVolumes(await client(), days);
  const busiest = Math.max(...volumes.map((v) => v.count), 1);

  return days.map((d) => {
    const count = volumes.find((v) => v.day === d)?.count ?? 0;
    const date = new Date(`${d}T00:00:00`);

    return {
      day: d,
      weekday: date.toLocaleDateString(undefined, { weekday: "narrow" }),
      date: String(date.getDate()),
      count,
      weight: count / busiest,
      selected: false,
      isToday: d === today,
    };
  });
});

/** The connected address, needed to read your own reply off an invitation. */
const reader = cache(async () =>
  fetchAccountEmail(await client()).catch(() => ""),
);

/**
 * The order the day is read in.
 *
 * Urgency first, because that is the one judgement the model was asked to make
 * about how much a message wants. Then whether anything is being asked at all,
 * then the nearest date, and only then the clock — arrival time is the weakest
 * signal there is and it decides nothing but ties.
 */
function byPriority(a: DigestItem, b: DigestItem) {
  const urgency = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
  if (urgency !== 0) return urgency;

  if (a.needsReply !== b.needsReply) return a.needsReply ? -1 : 1;

  // A dated message outranks an undated one at the same urgency, soonest first.
  if (a.due !== b.due) {
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.localeCompare(b.due);
  }

  return b.receivedAt.localeCompare(a.receivedAt);
}

export const getDay = cache(
  async (day: string, useAi = true): Promise<DayDigest> => {
    const auth = await client();
    const { signal, bulk, truncated } = await fetchDay(auth, day, {
      reader: await reader(),
    });

    const insights = await fetchInsights(day, signal, bulk, useAi);

    const withInsight = (message: DigestMessage): DigestItem => {
      const insight = insights.byId[message.id] ?? {
        purpose: message.subject,
        blurb: "",
        due: "",
        dueKind: "none" as const,
        category: "updates" as const,
        urgency: "low" as const,
        needsReply: false,
      };

      return {
        ...message,
        ...insight,
        // Whatever the model called it, a message carrying an invitation is
        // about a scheduled thing, and its date is when that thing happens.
        category: message.invite ? "meetings" : insight.category,
        dueKind: message.invite ? ("event" as const) : insight.dueKind,
      };
    };

    const items = [
      // The body stays on the server. It was downloaded for the model, and
      // fifty of them would dwarf everything else the page sends.
      ...signal.map(({ text, ...message }) => {
        void text;
        return withInsight(message);
      }),
      ...bulk.map(withInsight),
    ].sort(byPriority);

    const inCategory = (key: Category) =>
      items.filter((item) => item.category === key);

    return {
      day,
      recap: insights.recap,
      source: insights.source,
      total: items.length,
      truncated,
      categories: CATEGORIES.map((key) => {
        const group = inCategory(key);
        return {
          key,
          title: CATEGORY_TITLES[key],
          count: group.length,
          replies: group.filter((item) => item.needsReply).length,
        };
      }),
      items,
    };
  },
);
