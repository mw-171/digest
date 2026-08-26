"use client";

import * as React from "react";

import { CardList, SocialGroups } from "./cards";
import { CATEGORY_BLURB } from "./categories";
import { CalendarSheet } from "./calendar-sheet";
import { FocusRule, Tiles, VolumeBar, type SortMode } from "./tiles";
import { WeekRail } from "./week-rail";
import * as Button from "@/app/component/ui/button";
import { formatDayTitle, formatPillDate, toDayString } from "@/lib/day";
import type { Category } from "@/lib/digest-ai";
import type { DayDigest, Digest, DigestItem } from "@/lib/digest";

/**
 * Page frame. The whole page scrolls — the header stays put by being sticky —
 * so this is one column that widens with the viewport rather than a phone
 * screen pinned to the middle of a desktop monitor.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col bg-bg-white-0">{children}</div>;
}

/** Content column. Every band of the page shares this width and padding. */
export function Column({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full min-w-0 max-w-[440px] px-6 md:max-w-3xl md:px-10 lg:max-w-5xl lg:px-12 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/**
 * The sticky header: the week, the date, and the way to any other date.
 *
 * Nothing else lives up here. The recap, the bar and the tiles all belong to
 * the day being read rather than to the act of choosing one, so they scroll
 * away with the mail they describe and the sticky part stays two rows tall.
 */
export function HeaderFrame({
  day,
  rail,
  onSelectDay,
}: {
  day: string;
  rail: React.ReactNode;
  onSelectDay?: (day: string) => void;
}) {
  const title = formatDayTitle(day);

  return (
    <header className="sticky top-0 z-10 border-b border-stroke-soft-200 bg-bg-white-0">
      <Column className="pb-4 pt-4 md:pb-5 md:pt-6">
        {rail}

        <div className="mt-4 flex items-center justify-between gap-3 md:mt-5">
          <h1 className="min-w-0 break-words text-title-h4 tracking-[-0.035em] text-text-strong-950 md:text-title-h3">
            {title.weekday}
          </h1>
          <CalendarSheet
            day={day}
            label={formatPillDate(day)}
            onSelect={onSelectDay}
          />
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
      <p className="mt-6 text-title-h6 tracking-[-0.02em] text-text-strong-950">
        All four empty
      </p>
      <p className="mt-2 text-paragraph-sm text-text-sub-600">
        No mail arrived on {title.full}.
      </p>
      <Button.Root
        asChild
        variant="neutral"
        mode="stroke"
        size="xsmall"
        className="mt-5"
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
 * The day itself: a sentence, the bar, the four tiles, and whatever the tiles
 * left in the list.
 *
 * Priority order arrives already applied — the server sorts on the urgency
 * Claude assigned, which is the one ranking this page cannot compute for
 * itself. Recent is the cheap local alternative, so switching between them
 * never refetches anything.
 *
 * Social is the one lane that does not render as cards. Forty promotions are
 * forty rows of the same fact, so they collapse into a handful of sender rows
 * whether or not they are the thing being filtered for — the tile above still
 * counts every one of them.
 */
export function DayView({
  digest,
  focus,
  onFocus,
  sort,
  onSort,
}: {
  digest: DayDigest;
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

  return (
    <Column className="flex-1 pb-4">
      <RecapLine text={digest.recap} />
      <VolumeBar categories={digest.categories} />

      <div className="pt-5">
        <Tiles categories={digest.categories} focus={focus} onFocus={onFocus} />
      </div>

      <FocusRule
        label={label}
        filtered={focus !== null}
        onClear={() => onFocus(null)}
        sort={sort}
        onSort={onSort}
      />

      {visible.length === 0 && focus ? (
        <EmptyLane category={focus} onClear={() => onFocus(null)} />
      ) : (
        <>
          <CardList items={rest} day={digest.day} />
          <SocialGroups
            items={social}
            day={digest.day}
            heading={focus === null && rest.length > 0}
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

/**
 * Settings, provenance, and the way out.
 *
 * Everything here is nowrap by nature — a switch and its label can't be broken
 * mid-word — so on a phone the row is two: the toggles wrap onto the first,
 * provenance and Disconnect share the second. Above `md` there is room for one
 * line again. `overflow-x-hidden` on the footer is the backstop that keeps a
 * long label from scrolling the whole page sideways.
 */
export function Footer({
  source,
  toggle,
}: {
  source?: DayDigest["source"];
  toggle?: React.ReactNode;
}) {
  const provenance =
    source === "claude"
      ? "Triaged by Claude"
      : source === "heuristic"
        ? "Sorted by Gmail labels"
        : "";

  return (
    <footer className="mt-auto overflow-x-hidden border-t border-stroke-soft-200">
      <Column className="flex flex-col gap-3 py-4 text-label-xs text-text-soft-400 md:flex-row md:items-center md:justify-between md:gap-6">
        {toggle && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            {toggle}
          </div>
        )}
        <div className="flex min-w-0 items-center justify-between gap-4 md:justify-end">
          <span className="min-w-0 truncate">{provenance}</span>
          <a href="/api/auth/logout" className="shrink-0 underline">
            Disconnect
          </a>
        </div>
      </Column>
    </footer>
  );
}

/** Fully-resolved digest, no suspense. Used by the fixture route. */
export function DigestScreen({ digest }: { digest: Digest }) {
  const [focus, setFocus] = React.useState<Category | null>(null);
  const [sort, setSort] = React.useState<SortMode>("priority");

  return (
    <Shell>
      <HeaderFrame day={digest.day} rail={<WeekRail week={digest.week} />} />
      <DayView
        digest={digest}
        focus={focus}
        onFocus={setFocus}
        sort={sort}
        onSort={setSort}
      />
      <Footer source={digest.source} />
    </Shell>
  );
}
