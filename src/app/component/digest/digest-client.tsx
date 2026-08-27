"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { Toggle } from "./toggle";
import { DayView, Footer, HeaderFrame, Shell } from "./digest-screen";
import { DaySkeleton, WeekRailSkeleton } from "./skeletons";
import { WeekRail } from "./week-rail";
import type { SortMode } from "./tiles";
import * as Button from "@/app/component/ui/button";
import { aiCookieValue } from "@/lib/preferences";
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
  today,
  initialAi,
}: {
  initialDay: string;
  today: string;
  initialAi: boolean;
}) {
  const [day, setDay] = React.useState(initialDay);
  const [focus, setFocus] = React.useState<Category | null>(null);
  // Sort is a habit, not a property of the day, so it survives paging back.
  const [sort, setSort] = React.useState<SortMode>("priority");
  const [options, setOptions] = React.useState<DigestOptions>({ useAi: initialAi });
  const queryClient = useQueryClient();

  const dayResult = useQuery(dayQuery(day, today, options));
  const weekResult = useQuery(weekQuery(today));

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

  // Keep the browser's back button working with the pushed URLs.
  React.useEffect(() => {
    const onPop = () => {
      const param = new URLSearchParams(window.location.search).get("date");
      setDay(param ?? today);
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
        onSelectDay={select}
        rail={
          weekResult.data ? (
            // The rail belongs to the week, not to the day being fetched: the
            // selected pill moves the instant you pick a day, while the
            // volumes stay put until the new week actually lands.
            <WeekRail
              week={weekResult.data.map((entry) => ({
                ...entry,
                selected: entry.day === day,
              }))}
              onSelect={select}
            />
          ) : (
            <WeekRailSkeleton />
          )
        }
      />

      {dayResult.isError ? (
        <ErrorPanel error={dayResult.error} />
      ) : dayResult.data ? (
        <DayView
          digest={dayResult.data}
          focus={focus}
          onFocus={setFocus}
          sort={sort}
          onSort={setSort}
        />
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
