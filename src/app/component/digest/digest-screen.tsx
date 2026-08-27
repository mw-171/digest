"use client";

import * as React from "react";

import { CardList, SocialCards } from "./cards";
import { CATEGORY_BLURB } from "./categories";
import { CalendarSheet } from "./calendar-sheet";
import { Column, Footer, Shell } from "./layout-frame";
import {
  FocusRule,
  QuietRule,
  Tiles,
  VolumeBar,
  type SortMode,
} from "./tiles";
import { WeekRail } from "./week-rail";
import * as Button from "@/app/component/ui/button";
import { formatDayTitle, formatPillDate, toDayString } from "@/lib/day";
import type { Category } from "@/lib/digest-ai";
import type { DayDigest, Digest, DigestItem } from "@/lib/digest";

export { Column, Footer, Shell };



/**
 * The sticky header: the week, the date, and the way to any other date, and
 * nothing else. The recap, bar and tiles belong to the day being read rather
 * than to choosing one, so they scroll away with the mail they describe.
 */
export function HeaderFrame({
  day,
  today,
  rail,
  onSelectDay,
}: {
  day: string;
  /** Omitted by the fixture route, which has no live clock. */
  today?: string;
  rail: React.ReactNode;
  onSelectDay?: (day: string) => void;
}) {
  const title = formatDayTitle(day);
  // Nothing to go back to when you are already there.
  const away = today !== undefined && day !== today;

  return (
    <header className="safe-top sticky top-0 z-10 border-b border-stroke-soft-200 bg-bg-white-0">
      <Column className="pb-4 md:pb-5 md:pt-2">
        {rail}

        <div className="mt-4 flex items-center justify-between gap-3 md:mt-5">
          <h1 className="min-w-0 break-words text-title-h4 tracking-[-0.035em] text-text-strong-950 md:text-title-h3">
            {title.weekday}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            {/*
              The way back, as today's date rather than the word for it: a
              square the same height as the date pill instead of a second
              label competing with it. It rides with the date rather than
              living in the picker, so returning never costs opening one.
            */}
            {away && (
              <Button.Root
                asChild={!onSelectDay}
                variant="neutral"
                mode="stroke"
                size="xsmall"
                className="w-8 shrink-0 justify-center px-0 font-semibold tabular-nums"
                title="Today"
                aria-label={`Jump to today, ${formatPillDate(today)}`}
                onClick={onSelectDay ? () => onSelectDay(today) : undefined}
              >
                {onSelectDay ? (
                  formatDayTitle(today).dayOfMonth
                ) : (
                  <a href="/">{formatDayTitle(today).dayOfMonth}</a>
                )}
              </Button.Root>
            )}
            <CalendarSheet
              day={day}
              label={formatPillDate(day)}
              onSelect={onSelectDay}
            />
          </div>
        </div>
      </Column>
    </header>
  );
}

/** The day in a sentence. */
export function RecapLine({ text }: { text: string }) {
  if (!text) return null;

  return (
    <p className="break-words pb-4 pt-5 text-paragraph-sm text-text-sub-600 text-pretty md:text-paragraph-md">
      {text}
    </p>
  );
}

export function Empty({ day }: { day: string }) {
  const title = formatDayTitle(day);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-11 py-24 text-center">
      <div aria-hidden className="grid w-[120px] grid-cols-2 gap-1.5">
        <span className="h-10 rounded-xl bg-bg-weak-50" />
        <span className="h-10 rounded-xl bg-bg-weak-50" />
        <span className="h-10 rounded-xl bg-bg-weak-50/60" />
        <span className="h-10 rounded-xl bg-bg-weak-50/60" />
      </div>
      <p className="mt-6 text-title-h5 tracking-[-0.02em] text-text-strong-950">
        No emails
      </p>
      <p className="mt-2 text-paragraph-sm text-text-sub-600">
        Nothing arrived on {title.long}.
      </p>
      {/* The only way out of a day with nothing in it, so it is the one filled
          button on the screen rather than a quiet outline. */}
      <Button.Root
        asChild
        variant="neutral"
        mode="filled"
        size="medium"
        className="mt-6 px-6"
      >
        <a href={`/?date=${toDayString()}`}>Back to today</a>
      </Button.Root>
    </div>
  );
}

/** Nothing in the lane you picked, but plenty in the others. */
function EmptyLane({ category, onClear }: { category: Category; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <p className="text-label-md text-text-strong-950">Nothing here today</p>
      <p className="mt-1.5 text-paragraph-sm text-text-sub-600">
        {CATEGORY_BLURB[category]}. None arrived.
      </p>
      <Button.Root
        variant="neutral"
        mode="stroke"
        size="xsmall"
        className="mt-5"
        onClick={onClear}
      >
        Show everything
      </Button.Root>
    </div>
  );
}

const byNewest = (a: DigestItem, b: DigestItem) =>
  b.receivedAt.localeCompare(a.receivedAt);

/**
 * The day itself: a sentence, the bar, the four tiles, and whatever they left.
 * Priority order arrives already applied from the server, so switching to
 * Recent never refetches; Social collapses into sender rows rather than cards,
 * however the tiles are filtered.
 */
export function DayView({
  digest,
  today,
  focus,
  onFocus,
  sort,
  onSort,
}: {
  digest: DayDigest;
  /**
   * Arrival times are shown only on today's digest. On a day already behind
   * you "2:57 PM" answers a question nobody asked — the ordering already says
   * what came first — and it costs the top line the room a deadline or a
   * thread count can use instead.
   */
  today?: string;
  focus: Category | null;
  onFocus: (next: Category | null) => void;
  sort: SortMode;
  onSort: (next: SortMode) => void;
}) {
  if (digest.total === 0) return <Empty day={digest.day} />;

  const ordered =
    sort === "recent" ? [...digest.items].sort(byNewest) : digest.items;
  const visible = focus
    ? ordered.filter((item) => item.category === focus)
    : ordered;
  const social = visible.filter((item) => item.category === "social");
  const rest = visible.filter((item) => item.category !== "social");
  const label = focus
    ? (digest.categories.find((group) => group.key === focus)?.title ?? "Everything")
    : "Everything";

  // Grouping is a property of the priority order — in Recent the list is
  // deliberately chronological, and cutting it in two would contradict that.
  // A filtered lane is already one subset and does not want a second.
  const wants = (item: DigestItem) => item.needsReply || item.urgency === "high";
  const grouped = sort === "priority" && focus === null;
  const topOfMind = grouped ? rest.filter(wants) : [];
  const others = grouped ? rest.filter((item) => !wants(item)) : rest;
  // A quiet day is one clean list, not an empty section and a label for the
  // remainder of nothing.
  const split = topOfMind.length > 0;

  return (
    <Column className="flex-1 pb-4">
      <RecapLine text={digest.recap} />
      <VolumeBar
        categories={digest.categories}
        focus={focus}
        onFocus={onFocus}
      />

      <div className="pt-5">
        <Tiles categories={digest.categories} focus={focus} onFocus={onFocus} />
      </div>

      <FocusRule
        label={split ? "Top of mind" : label}
        count={split ? topOfMind.length : undefined}
        filtered={focus !== null}
        onClear={() => onFocus(null)}
        sort={sort}
        onSort={onSort}
      />

      {visible.length === 0 && focus ? (
        <EmptyLane category={focus} onClear={() => onFocus(null)} />
      ) : (
        <>
          <CardList
            items={split ? topOfMind : rest}
            day={digest.day}
            showTime={digest.day === today}
          />
          {split && (
            <>
              <QuietRule label="Everything else" />
              <CardList
                items={others}
                day={digest.day}
                showTime={digest.day === today}
              />
            </>
          )}
          <SocialCards
            items={social}
            day={digest.day}
            showTime={digest.day === today}
          />
        </>
      )}

      <p className="py-7 text-center text-label-xs text-text-soft-400">
        end of day!
        {digest.truncated && " (first 50 messages)"}
      </p>
    </Column>
  );
}


/** Fully-resolved digest, no suspense. Used by the fixture route. */
export function DigestScreen({
  digest,
  today,
}: {
  digest: Digest;
  /** The fixture's "now", which need not be the day being shown. */
  today?: string;
}) {
  const [focus, setFocus] = React.useState<Category | null>(null);
  const [sort, setSort] = React.useState<SortMode>("priority");

  return (
    <Shell>
      <HeaderFrame
        day={digest.day}
        today={today}
        rail={<WeekRail week={digest.week} />}
      />
      <DayView
        digest={digest}
        today={today}
        focus={focus}
        onFocus={setFocus}
        sort={sort}
        onSort={setSort}
      />
      <Footer source={digest.source} />
    </Shell>
  );
}
