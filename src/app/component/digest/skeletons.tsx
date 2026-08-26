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

export function RecapSkeleton() {
  return (
    <div className="mt-4 animate-pulse border-t border-stroke-soft-200 pt-4 md:mt-0 md:flex-1 md:border-l md:border-t-0 md:pb-2 md:pl-10 md:pt-0">
      <div className="h-3 w-[92%] rounded-full bg-bg-weak-50" />
      <div className="mt-2.5 h-3 w-[64%] rounded-full bg-bg-weak-50" />
    </div>
  );
}

/** A band header plus a few message cards. */
export function BandsSkeleton() {
  return (
    <Column className="animate-pulse pb-4 pt-1.5">
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
          <div className="md:flex md:items-end md:gap-10">
            <WeekStripSkeleton />
            <RecapSkeleton />
          </div>
        </Column>
      </div>
      <BandsSkeleton />
    </>
  );
}
