import { cache } from "react";

import { toDayString, weekWindow } from "@/lib/day";
import { fetchInsights, TRIAGE_BANDS, type Band, type Insight } from "@/lib/digest-ai";
import {
  fetchAccountEmail,
  fetchDay,
  fetchVolumes,
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
  /** Signal only. Noise is counted by the length of its own list. */
  total: number;
  truncated: boolean;
  bands: BandGroup[];
  noise: DigestItem[];
};

export type Digest = DayDigest & { week: WeekDay[] };

const BAND_TITLES: Record<Band, string> = {
  needs: "NEEDS YOU",
  fyi: "FYI",
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
export const getWeek = cache(async (day: string): Promise<WeekDay[]> => {
    const today = toDayString();
    const days = weekWindow(day, today);
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
        height: count
          ? Math.max(BAR_MIN, Math.round((count / busiest) * BAR_MAX))
          : BAR_MIN,
        selected: d === day,
        isToday: d === today,
      };
    });
  },
);

/** The connected address, needed to read your own reply off an invitation. */
const reader = cache(async () => fetchAccountEmail(await client()).catch(() => ""));

export const getDay = cache(
  async (day: string, useAi = true): Promise<DayDigest> => {
    const auth = await client();
    const { signal, noise, truncated } = await fetchDay(auth, day, {
      reader: await reader(),
    });

    // Only signal is triaged. Noise was settled by Gmail's labels before any
    // of it was fetched, and asking the model to confirm that would cost a
    // round trip to learn what a label already said.
    const insights = await fetchInsights(day, signal, useAi);

    const items: DigestItem[] = signal.map(({ text, ...message }) => {
      // The body stays on the server. It was downloaded for the model, and
      // fifty of them would dwarf everything else the page sends.
      void text;

      return {
        ...message,
        ...(insights.byId[message.id] ?? {
          purpose: message.subject,
          due: "",
          band: "fyi" as const,
        }),
      };
    });

    const inBand = (band: Band) => items.filter((item) => item.band === band);

    return {
      day,
      recap: insights.recap,
      source: insights.source,
      total: signal.length,
      truncated,
      bands: TRIAGE_BANDS.map((key) => ({
        key,
        title: BAND_TITLES[key],
        items: inBand(key),
      })),
      // Headline only: noise has no body, no insight and no card.
      noise: noise.map((message) => ({
        ...message,
        purpose: message.subject,
        due: "",
        band: "noise" as const,
      })),
    };
  },
);
