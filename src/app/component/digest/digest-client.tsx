"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { Toggle } from "./toggle";
import { DayView, Footer, HeaderFrame, Shell } from "./digest-screen";
import { DaySkeleton } from "./skeletons";
import { WeekRail } from "./week-rail";
import type { SortMode } from "./tiles";
import * as Button from "@/app/component/ui/button";
import { aiCookieValue } from "@/lib/preferences";
import { cn } from "@/utils/cn";
import { railDays, recentreAnchor, toDayString, windowFrom } from "@/lib/day";
import type { Category } from "@/lib/digest-ai";
import {
  dayQuery,
  previousDay,
  weekQuery,
  type DigestOptions,
} from "@/lib/digest-query";

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
   * Which seven days the rail is showing, as its first day.
   *
   * State, not a function of the selection: stepping between pills has to
   * leave the rail where it is, or every tap in a past week would re-centre
   * the strip under your finger. Only the date picker moves it.
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
        onSelectDay={selectFromPicker}
        rail={<WeekRail week={week} onSelect={selectFromRail} />}
      />

      {dayResult.isError ? (
        <ErrorPanel error={dayResult.error} />
      ) : dayResult.data ? (
        // Held-over content, on its way out. Dimmed rather than removed, so the
        // switch is one fade instead of a collapse and a re-expand.
        <div
          className={cn(
            "flex flex-1 flex-col transition-opacity duration-200 ease-out",
            dayResult.isPlaceholderData && "opacity-40",
          )}
        >
          <DayView
            digest={dayResult.data}
            focus={focus}
            onFocus={setFocus}
            sort={sort}
            onSort={setSort}
          />
        </div>
      ) : (
        <DaySkeleton />
      )}

      <Footer
        source={dayResult.data?.source}
        toggle={
          <Toggle
            value={options.useAi}
            label={`AI triage ${options.useAi ? "on" : "off"}`}
            onChange={(next) => {
              // The cookie is what stops the *next* page load calling out.
              document.cookie = aiCookieValue(next);
              setOptions({ useAi: next });
            }}
          />
        }
      />
    </Shell>
  );
}
