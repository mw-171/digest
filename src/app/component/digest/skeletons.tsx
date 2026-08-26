import { Column } from "./digest-screen";

const BARS = [1, 2, 3, 4, 5, 6, 7];
const ROWS = [1, 2, 3, 4];

/** The week strip while its volumes load. Same footprint as the real bars. */
export function WeekStripSkeleton() {
  return (
    <div className="mt-4 flex animate-pulse items-end gap-1.5 md:mt-0 md:w-[340px] md:shrink-0 md:gap-2 lg:w-[420px] lg:gap-3">
      {BARS.map((bar) => (
        <div key={bar} className="flex flex-1 flex-col items-center gap-[7px] py-1">
          <span className="flex h-12 w-full items-end justify-center md:h-[68px]">
            <span className="h-7 w-4 rounded-[5px] bg-bg-weak-50 md:h-10 md:w-6 lg:w-8" />
          </span>
          <span className="h-3 w-4 rounded-full bg-bg-weak-50" />
          <span className="h-2 w-2 rounded-full bg-bg-weak-50" />
        </div>
      ))}
    </div>
  );
}

/** The recap line, which now scrolls with the mail rather than sitting above it. */
export function RecapSkeleton() {
  return (
    <div className="pb-1 pt-5">
      <div className="h-3 w-[86%] rounded-full bg-bg-weak-50" />
      <div className="mt-2.5 h-3 w-[52%] rounded-full bg-bg-weak-50" />
    </div>
  );
}

/** A band header plus a few message cards. */
export function BandsSkeleton() {
  return (
    <Column className="animate-pulse pb-4">
      <RecapSkeleton />

      <div className="flex items-center gap-2.5 pb-2.5 pt-5">
        <span className="size-[9px] rounded-[3px] bg-bg-soft-200" />
        <span className="h-3 w-24 rounded-full bg-bg-weak-50" />
        <span className="h-px flex-1 bg-stroke-soft-200" />
      </div>

      {ROWS.map((row) => (
        <div
          key={row}
          className="mb-[7px] flex min-h-[58px] items-center gap-3 rounded-2xl bg-bg-white-0 p-[13px] md:min-h-[68px] md:gap-4 md:px-5 md:py-4"
        >
          <div className="size-8 shrink-0 rounded-full bg-bg-weak-50" />
          <div className="flex-1 md:flex md:items-center md:gap-6">
            <div className="h-2.5 w-[42%] rounded-full bg-bg-weak-50 md:flex-1" />
            <div className="mt-2 h-2.5 w-[74%] rounded-full bg-bg-soft-200/60 md:mt-0 md:w-40" />
          </div>
        </div>
      ))}
    </Column>
  );
}

/** The whole page, for the route-level loading boundary. */
export function DigestSkeleton() {
  return (
    <>
      <div className="border-b border-stroke-soft-200 bg-bg-white-0">
        <Column className="pb-5 pt-5 md:pb-7 md:pt-8">
          <div className="flex animate-pulse items-baseline justify-between gap-3">
            <div className="h-8 w-40 rounded-lg bg-bg-weak-50 md:h-11 md:w-64" />
            <div className="h-8 w-32 rounded-lg bg-bg-weak-50" />
          </div>
          <WeekStripSkeleton />
        </Column>
      </div>
      <BandsSkeleton />
    </>
  );
}

/**
 * The message detail view while Gmail is being read. Deliberately the same
 * frame as the real page — back link, title, sender row, summary card — so the
 * arriving content settles into place instead of replacing something else.
 */
export function MessageSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-white-0">
      <div className="mx-auto w-full min-w-0 max-w-[440px] px-6 md:max-w-2xl md:px-10">
        <header className="flex items-center justify-between pb-3 pt-5 md:pt-8">
          <span className="text-label-sm text-text-sub-600">‹ Digest</span>
          <span className="text-label-xs uppercase tracking-[0.08em] text-text-soft-400">
            Read only
          </span>
        </header>

        <div className="animate-pulse pb-16 pt-3">
          <div className="h-6 w-[78%] rounded-lg bg-bg-weak-50 md:h-8" />

          <div className="mt-5 flex items-center gap-3 border-b border-stroke-soft-200 pb-4">
            <div className="size-10 shrink-0 rounded-full bg-bg-weak-50" />
            <div className="flex-1">
              <div className="h-3 w-32 rounded-full bg-bg-weak-50" />
              <div className="mt-2 h-2.5 w-44 rounded-full bg-bg-weak-50" />
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-bg-weak-50 p-5 md:p-6">
            <div className="h-2.5 w-16 rounded-full bg-bg-soft-200" />
            <div className="mt-4 flex flex-col gap-2.5">
              <div className="h-3 w-full rounded-full bg-bg-soft-200" />
              <div className="h-3 w-[92%] rounded-full bg-bg-soft-200" />
              <div className="h-3 w-2/3 rounded-full bg-bg-soft-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
