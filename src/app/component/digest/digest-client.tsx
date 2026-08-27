"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { Toggle } from "./toggle";
import { DayView, Footer, HeaderFrame, Shell } from "./digest-screen";
import {
  BUSY_BLUR,
  BUSY_TRANSITION,
  COLD_BLUR,
  DigestingOverlay,
} from "./digesting";
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

/** How long every fade in this screen takes. */
const FADE_MS = 500;

/**
 * `on`, but held true for `ms` after it goes false. A layer that unmounts the
 * moment its reason disappears cannot fade out; this keeps it long enough to.
 */
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

/**
 * The digest, driven by the client query cache.
 *
 * Picking a day never round-trips the router: the day is component state, the
 * URL is kept in step with `replaceState`, and both queries answer from cache
 * when that day has already been triaged.
 */
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
  /**
   * The server's clock is not the reader's — on Vercel it is UTC, which turns
   * over while most of the world is still on the previous evening. The first
   * paint has to use what the server sent, but from mount on, "today" is the
   * browser's, and a selection the server thought was today is pulled back if
   * that turns out to be tomorrow where the reader is.
   */
  const [today, setToday] = React.useState(serverToday);
  /**
   * Which seven days the rail is showing, as its first day. State rather than a
   * function of the selection, or every tap in a past week would re-centre the
   * strip under your finger; only the date picker moves it.
   */
  const [anchor, setAnchor] = React.useState(() =>
    recentreAnchor(initialDay, serverToday),
  );

  React.useEffect(() => {
    const local = toDayString();
    if (local === serverToday) return;
    setToday(local);
    setDay((current) => (current > local ? local : current));
    setAnchor((current) =>
      // Only re-anchor a rail that was still sitting on the server's today.
      current === recentreAnchor(serverToday, serverToday)
        ? recentreAnchor(local, local)
        : current,
    );
  }, [serverToday]);

  const [focus, setFocus] = React.useState<Category | null>(null);
  // Sort is a habit, not a property of the day, so it survives paging back.
  const [sort, setSort] = React.useState<SortMode>("priority");
  const [options, setOptions] = React.useState<DigestOptions>({
    useAi: initialAi,
  });
  const queryClient = useQueryClient();

  const dayResult = useQuery(dayQuery(day, today, options));
  const weekResult = useQuery(weekQuery(anchor, today));

  // The pills are a calendar, so they are computed here and always rendered.
  // The volumes are a mailbox, so they are folded in whenever they arrive.
  const volumes = weekResult.data;
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

  /**
   * Waiting on mail: either the first read of the mailbox, or a day that has
   * not been triaged yet. A cached day answers instantly and never gets here.
   */
  /** Nothing to show yet: the mailbox has never been read in this session. */
  const cold = dayResult.data === undefined;
  /** Showing yesterday's answer while today's is fetched. */
  const stale = dayResult.isPlaceholderData;
  const busy = cold || stale;

  // Both layers outlive the state that raised them, so each one fades out
  // rather than being unmounted mid-transition. Removing an element is not a
  // transition; keeping it and animating its opacity to zero is.
  const coldLayer = useLingering(cold, FADE_MS);
  const overlay = useLingering(busy, FADE_MS);

  const select = React.useCallback(
    (next: string) => {
      if (next > today) return;
      setDay(next);
      // A filter belongs to the day it was set on. Carrying "Meetings" into a
      // day with no meetings would land on an empty screen for no reason.
      setFocus(null);
      window.history.pushState(null, "", `/?date=${next}`);
    },
    [today],
  );

  /** A pill: the rail keeps its place and only the selection moves. */
  const selectFromRail = select;

  /**
   * The date picker: the one way to leave the current window. If the date is
   * already on the rail nothing moves; otherwise the rail re-centres on it.
   */
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

  // People page backwards through a digest, so warm exactly one day back —
  // enough to make the next tap instant without paying Claude for days nobody
  // opens. Waits for the current day so the two never compete.
  React.useEffect(() => {
    if (!dayResult.isSuccess) return;
    const target = previousDay(day);
    queryClient.prefetchQuery(dayQuery(target, today, options));
  }, [day, dayResult.isSuccess, options, queryClient, today]);

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
        // One box for both waits. Switching days blurs the day you were
        // reading and holds it there; a cold start blurs the skeleton instead.
        // Either way the indicator sits in the same place, so arriving from
        // the connect screen and paging between days look like one app.
        <main id="content" className="relative flex flex-1 flex-col">
          <div
            className={cn(
              "flex flex-1 flex-col",
              BUSY_TRANSITION,
              stale && `${BUSY_BLUR} pointer-events-none select-none`,
            )}
          >
            {dayResult.data ? (
              <DayView
                digest={dayResult.data}
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

          {/*
            The cold-start skeleton, over the content rather than instead of
            it. Opaque while it waits, then dissolved — so the real digest is
            already laid out and sharp underneath by the time it shows through,
            and the swap is one fade with nothing blank in the middle.
          */}
          {coldLayer && (
            <div
              className={cn(
                "absolute inset-0 overflow-hidden bg-bg-white-0",
                "transition-opacity duration-500 ease-out",
                cold ? COLD_BLUR : "pointer-events-none opacity-0",
              )}
            >
              <DaySkeleton />
            </div>
          )}

          {overlay && <DigestingOverlay visible={busy} />}
        </main>
      )}

      <Footer
        source={dayResult.data?.source}
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
