import { cache } from "react";

import { toDayString, weekWindow } from "@/lib/day";
import { fetchInsights, type Band, type Insight } from "@/lib/digest-ai";
import {
  fetchDigest,
  fetchVolumes,
  isBulk,
  type DigestMessage,
} from "@/lib/gmail";
import { authorizedClient } from "@/lib/google";

export type DigestItem = DigestMessage & Insight;

export type BandGroup = {
  key: Band;
  title: string;
  items: DigestItem[];
};

export type WeekDay = {
  day: string;
  weekday: string;
  date: string;
  count: number;
  /** Bar height in px, 5–48, scaled against the busiest day in the window. */
  height: number;
  selected: boolean;
  isToday: boolean;
};

/** Everything about one day except its week context. */
export type DayDigest = {
  day: string;
  recap: string;
  source: "claude" | "heuristic";
  total: number;
  truncated: boolean;
  bands: BandGroup[];
  noise: DigestItem[];
  /** Bulk messages excluded from this fetch, when bulk is switched off. */
  hiddenBulk: number;
};

export type Digest = DayDigest & { week: WeekDay[] };

const BAND_TITLES: Record<Band, string> = {
  needs: "NEEDS YOU",
  notifications: "NOTIFICATIONS",
  noise: "NOISE",
};

const BAR_MAX = 48;
const BAR_MIN = 5;

async function client() {
  const auth = await authorizedClient();
  if (!auth) throw new Error("Not connected to Gmail.");
  return auth;
}

/**
 * The week strip. Separate from {@link getDay} — and much faster, since it only
 * counts ids — so the bars can render while the day is still being triaged.
 *
 * `cache` dedupes within a render, so several components may call these freely.
 */
export const getWeek = cache(
  async (day: string, includeBulk = false): Promise<WeekDay[]> => {
    const today = toDayString();
    const days = weekWindow(day, today);
    const volumes = await fetchVolumes(await client(), days, { includeBulk });
    const busiest = Math.max(...volumes.map((v) => v.count), 1);

    return days.map((d) => {
      const count = volumes.find((v) => v.day === d)?.count ?? 0;
      const date = new Date(`${d}T00:00:00`);

      return {
        day: d,
        weekday: date.toLocaleDateString(undefined, { weekday: "narrow" }),
        date: String(date.getDate()),
        count,
        height: count
          ? Math.max(BAR_MIN, Math.round((count / busiest) * BAR_MAX))
          : BAR_MIN,
        selected: d === day,
        isToday: d === today,
      };
    });
  },
);

export const getDay = cache(
  async (
    day: string,
    useAi = true,
    includeBulk = false,
  ): Promise<DayDigest> => {
    const { messages, truncated, hiddenBulk } = await fetchDigest(
      await client(),
      day,
      { includeBulk },
    );
    const insights = await fetchInsights(day, messages, useAi);

    const items: DigestItem[] = messages.map((message) => {
      const insight = insights.byId[message.id] ?? {
        purpose: message.subject,
        when: "",
        band: "notifications" as const,
      };

      // Gmail's own categories beat the model here: promotions, social and
      // forums are noise by definition, whatever the subject line claims.
      return {
        ...message,
        ...insight,
        band: isBulk(message.category) ? ("noise" as const) : insight.band,
      };
    });

    const inBand = (band: Band) => items.filter((item) => item.band === band);

    return {
      day,
      recap: insights.recap,
      source: insights.source,
      total: messages.length,
      truncated,
      bands: (["needs", "notifications"] as const).map((key) => ({
        key,
        title: BAND_TITLES[key],
        items: inBand(key),
      })),
      noise: inBand("noise"),
      hiddenBulk,
    };
  },
);

