import { BandSection, NoiseSection } from "./bands";
import { CalendarSheet } from "./calendar-sheet";
import { WeekStrip } from "./week-strip";
import * as Button from "@/app/component/ui/button";
import { formatDayTitle, formatPillDate, toDayString } from "@/lib/day";
import type { DayDigest, Digest } from "@/lib/digest";

/**
 * Page frame. The whole page scrolls — the header stays put by being sticky —
 * so this is one column that widens with the viewport rather than a phone
 * screen pinned to the middle of a desktop monitor.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-weak-50">{children}</div>
  );
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
 * The sticky header: the date, the picker, and the week's bars. Nothing else —
 * every row that lives up here is a row of mail that doesn't, and the recap
 * reads perfectly well from the top of the scrolling column instead.
 */
export function HeaderFrame({
  day,
  bars,
  onSelectDay,
}: {
  day: string;
  bars: React.ReactNode;
  onSelectDay?: (day: string) => void;
}) {
  const title = formatDayTitle(day);

  return (
    <header className="sticky top-0 z-10 border-b border-stroke-soft-200 bg-bg-white-0">
      <Column className="pb-5 pt-5 md:pb-7 md:pt-8">
        <div className="flex items-baseline items-center justify-between gap-3">
          <h1 className="min-w-0 break-words text-title-h4 tracking-[-0.035em] text-text-strong-950 md:text-title-h3">
            {title.weekday}
          </h1>
          <CalendarSheet
            day={day}
            label={formatPillDate(day)}
            onSelect={onSelectDay}
          />
        </div>

        {bars}
      </Column>
    </header>
  );
}

/** The day in a sentence. Scrolls away with the mail it describes. */
export function RecapLine({ text }: { text: string }) {
  return (
    <p className="break-words pb-1 pt-5 text-paragraph-sm text-text-sub-600 text-pretty md:text-paragraph-md">
      {text}
    </p>
  );
}

export function Empty({ day, noise = 0 }: { day: string; noise?: number }) {
  const title = formatDayTitle(day);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-11 py-24 text-center">
      <div aria-hidden className="flex h-8 items-end gap-[5px]">
        <span className="h-[5px] w-3.5 rounded-[3px] bg-bg-soft-200" />
        <span className="h-[5px] w-3.5 rounded-[3px] bg-bg-soft-200" />
        <span className="h-[5px] w-3.5 rounded-[3px] bg-bg-soft-200" />
      </div>
      <p className="mt-5 text-title-h6 tracking-[-0.02em] text-text-strong-950">
        Nothing needs you
      </p>
      <p className="mt-2 text-paragraph-sm text-text-sub-600">
        {noise > 0
          ? `Only promotions and newsletters arrived on ${title.full}.`
          : `No mail arrived on ${title.full}.`}
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

/** The recap, the urgency bands, then the collapsed noise row. */
export function BandsList({ digest }: { digest: DayDigest }) {
  if (digest.total === 0 && digest.noise.length === 0) {
    return <Empty day={digest.day} />;
  }

  return (
    <Column className="flex-1 pb-4">
      <RecapLine text={digest.recap} />

      {digest.total === 0 ? (
        <Empty day={digest.day} noise={digest.noise.length} />
      ) : (
        digest.bands.map((band) => (
          <BandSection
            key={band.key}
            title={band.title}
            items={band.items}
            day={digest.day}
            muted={band.key !== "needs"}
          />
        ))
      )}

      <NoiseSection items={digest.noise} day={digest.day} />

      <p className="py-7 text-center text-label-xs text-text-soft-400">
        That was the day.
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
  return (
    <Shell>
      <HeaderFrame day={digest.day} bars={<WeekStrip week={digest.week} />} />
      <BandsList digest={digest} />
      <Footer source={digest.source} />
    </Shell>
  );
}

