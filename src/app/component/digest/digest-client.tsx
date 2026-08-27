"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { Toggle } from "./toggle";
import { DayView, Footer, HeaderFrame, Shell } from "./digest-screen";
import { DigestingOverlay, Scrim } from "./digesting";
import { DaySkeleton } from "./skeletons";
import { WeekRail } from "./week-rail";
import type { SortMode } from "./tiles";
import * as Button from "@/app/component/ui/button";
import { SHOW_AI_TOGGLE, aiCookieValue } from "@/lib/preferences";
import { cn } from "@/utils/cn";
import { railDays, recentreAnchor, toDayString, windowFrom } from "@/lib/day";
import type { Category } from "@/lib/digest-ai";
import {
  dayQuery,
  weekKey,
  previousDay,
  weekQuery,
  type DigestOptions,
} from "@/lib/digest-query";

const FADE_MS = 500;

/** A fetch answered inside this never earns an indicator. */
const SHOW_DELAY_MS = 200;

/** `on`, held for `ms` after it goes false — long enough to fade out. */
function useLingering(on: boolean, ms: number) {
  const [alive, setAlive] = React.useState(on);

  React.useEffect(() => {
    if (on) {
      setAlive(true);
      return;
    }
    const timer = setTimeout(() => setAlive(false), ms);
    return () => clearTimeout(timer);
  }, [on, ms]);

  return alive;
}

/** `on`, but only once it has been true for `ms`. */
function useDelayed(on: boolean, ms: number) {
  const [late, setLate] = React.useState(false);

  React.useEffect(() => {
    if (!on) {
      setLate(false);
      return;
    }
    const timer = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(timer);
  }, [on, ms]);

  return late;
}

/**
 * False until React has hydrated. The persisted cache can restore before React
 * reaches this subtree, and rendering that data on the first pass makes the
 * client disagree with the server's HTML — React then rebuilds the whole tree.
 */
function useHydrated() {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  return hydrated;
}

function ErrorPanel({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  const reconnect =
    typeof error === "object" && error !== null && "reconnect" in error
      ? Boolean((error as { reconnect: unknown }).reconnect)
      : false;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-8 py-12">
      <p className="text-paragraph-sm text-error-base">{message}</p>
      {reconnect && (
        <Button.Root asChild variant="primary" mode="filled" className="mt-5">
          <a href="/api/auth/google">Reconnect Gmail</a>
        </Button.Root>
      )}
    </div>
  );
}

/** The digest. Picking a day is component state, never a router round-trip. */
export function DigestClient({
  initialDay,
  today: serverToday,
  initialAi,
}: {
  initialDay: string;
  today: string;
  initialAi: boolean;
}) {
  const [day, setDay] = React.useState(initialDay);
  // The server's clock is UTC on Vercel, which turns over while most of the
  // world is still on the previous evening. From mount on, today is the
  // browser's.
  const [today, setToday] = React.useState(serverToday);
  // The rail's window, as its first day. State rather than derived from the
  // selection, or every tap in a past week would re-centre it.
  const [anchor, setAnchor] = React.useState(() =>
    recentreAnchor(initialDay, serverToday),
  );

  React.useEffect(() => {
    const local = toDayString();
    if (local === serverToday) return;
    setToday(local);
    setDay((current) => (current > local ? local : current));
    setAnchor((current) =>
      current === recentreAnchor(serverToday, serverToday)
        ? recentreAnchor(local, local)
        : current,
    );
  }, [serverToday]);

  const [focus, setFocus] = React.useState<Category | null>(null);
  const [sort, setSort] = React.useState<SortMode>("priority");
  const [options, setOptions] = React.useState<DigestOptions>({
    useAi: initialAi,
  });
  const queryClient = useQueryClient();

  const dayResult = useQuery(dayQuery(day, options));
  const weekResult = useQuery(weekQuery(anchor));

  const hydrated = useHydrated();
  const digest = hydrated ? dayResult.data : undefined;

  // Pills are a calendar and need no network; volumes fold in when they land.
  const volumes = hydrated ? weekResult.data : undefined;
  const week = React.useMemo(
    () =>
      railDays(windowFrom(anchor), day, today).map((pill) => {
        const volume = volumes?.find((entry) => entry.day === pill.day);
        return volume
          ? { ...pill, count: volume.count, weight: volume.weight }
          : pill;
      }),
    [anchor, day, today, volumes],
  );

  // Derived from one another so the two loading states can never both show.
  // `cold` is nothing to display at all; `waiting` is the wrong day on screen
  // while the right one loads. A day we already hold shows at once.
  const hasData = digest !== undefined;
  const cold = !hasData;
  const waiting = useDelayed(
    hydrated && dayResult.isPlaceholderData,
    SHOW_DELAY_MS,
  );
  const busy = cold || waiting;

  // Each layer outlives its state so it can fade out. Unmounting is not a fade.
  const coldLayer = useLingering(cold, FADE_MS);
  const scrimLayer = useLingering(waiting, FADE_MS);
  const overlay = useLingering(busy, FADE_MS);

  const select = React.useCallback(
    (next: string) => {
      if (next > today) return;
      setDay(next);
      // A filter belongs to the day it was set on.
      setFocus(null);
      window.history.pushState(null, "", `/?date=${next}`);
    },
    [today],
  );

  const selectFromRail = select;

  /** The only way to leave the current window: re-centres if the date is off it. */
  const selectFromPicker = React.useCallback(
    (next: string) => {
      if (next > today) return;
      if (!windowFrom(anchor).includes(next)) {
        setAnchor(recentreAnchor(next, today));
      }
      select(next);
    },
    [anchor, select, today],
  );

  // Hold the page still while loading: a scroll begun mid-swap lands somewhere
  // arbitrary once the new day changes the page's height.
  React.useEffect(() => {
    if (!busy) return;

    const { documentElement: root, body } = document;
    const previous = [root.style.overflow, body.style.overflow] as const;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      root.style.overflow = previous[0];
      body.style.overflow = previous[1];
    };
  }, [busy]);

  // Keep the browser's back button working with the pushed URLs.
  React.useEffect(() => {
    const onPop = () => {
      const param = new URLSearchParams(window.location.search).get("date");
      const next = param ?? today;
      setDay(next);
      setAnchor((current) =>
        windowFrom(current).includes(next)
          ? current
          : recentreAnchor(next, today),
      );
      setFocus(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [today]);

  // Warm exactly one day back — people page backwards. Waits for the current
  // day so the two never compete.
  React.useEffect(() => {
    if (!dayResult.isSuccess) return;
    const target = previousDay(day);
    queryClient.prefetchQuery(dayQuery(target, options));
  }, [day, dayResult.isSuccess, options, queryClient]);

  return (
    <Shell>
      <HeaderFrame
        day={day}
        today={today}
        onSelectDay={selectFromPicker}
        rail={<WeekRail week={week} onSelect={selectFromRail} />}
      />

      {dayResult.isError ? (
        <ErrorPanel error={dayResult.error} />
      ) : (
        <main id="content" className="relative flex flex-1 flex-col">
          <div
            className={cn(
              "flex flex-1 flex-col",
              waiting && "pointer-events-none select-none",
            )}
          >
            {digest ? (
              <DayView
                digest={digest}
                today={today}
                focus={focus}
                onFocus={setFocus}
                sort={sort}
                onSort={setSort}
              />
            ) : (
              <div className="flex-1" />
            )}
          </div>

          {/* Suppressed while the skeleton is up, so the two never overlap. */}
          {scrimLayer && !coldLayer && <Scrim visible={waiting} />}

          {/* Over the content, not instead of it, so the swap is one fade with
              nothing blank in the middle. */}
          {coldLayer && (
            <div
              className={cn(
                "absolute inset-0 overflow-hidden bg-bg-white-0",
                "transition-opacity duration-500 ease-out",
                cold ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <DaySkeleton />
            </div>
          )}

          {overlay && <DigestingOverlay visible={busy} />}
        </main>
      )}

      <Footer
        source={digest?.source}
        toggle={
          SHOW_AI_TOGGLE ? (
            <Toggle
              value={options.useAi}
              label={`AI triage ${options.useAi ? "on" : "off"}`}
              onChange={(next) => {
                // The cookie is what stops the *next* page load calling out.
                document.cookie = aiCookieValue(next);
                setOptions({ useAi: next });
              }}
            />
          ) : undefined
        }
      />
    </Shell>
  );
}
