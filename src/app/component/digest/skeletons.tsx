import { DigestingOverlay } from "./digesting";
import { WeekRail } from "./week-rail";
import { anchoredWindow, railDays, toDayString } from "@/lib/day";
import { Column } from "./layout-frame";

const TILES = [1, 2, 3, 4];
const ROWS = [1, 2, 3, 4];


/** The recap line, which scrolls with the mail rather than sitting above it. */
export function RecapSkeleton() {
  return (
    <div className="pb-4 pt-5">
      <div className="h-3 w-[86%] rounded-full bg-bg-weak-50" />
      <div className="mt-2.5 h-3 w-[52%] rounded-full bg-bg-weak-50" />
    </div>
  );
}

/** The recap, the bar, the four tiles, and a few cards. */
export function DaySkeleton() {
  return (
    <Column className="animate-pulse pb-4">
      <RecapSkeleton />

      <div className="h-2 rounded bg-bg-weak-50" />

      <div className="grid grid-cols-2 gap-2 pt-5 md:grid-cols-4 md:gap-3">
        {TILES.map((tile) => (
          <div
            key={tile}
            className="h-[88px] rounded-2xl bg-bg-weak-50 md:h-[100px]"
          />
        ))}
      </div>

      <div className="flex items-center gap-2 pb-2 pt-6">
        <span className="h-3 w-20 rounded-full bg-bg-weak-50" />
        <span className="h-px flex-1 bg-stroke-soft-200" />
        <span className="h-3 w-14 rounded-full bg-bg-weak-50" />
      </div>

      {ROWS.map((row) => (
        <div
          key={row}
          className="mb-[7px] flex min-h-[58px] items-center gap-3.5 rounded-2xl bg-bg-white-0 p-[13px] md:min-h-[68px] md:gap-4 md:px-5 md:py-4"
        >
          {/* Ringed, like the real avatar, so the row does not resize when the
              mail lands. */}
          <div className="size-8 shrink-0 rounded-full bg-bg-weak-50 ring-2 ring-bg-soft-200/70 ring-offset-2 ring-offset-bg-white-0" />
          <div className="min-w-0 flex-1">
            <div className="h-2.5 w-[38%] rounded-full bg-bg-weak-50" />
            <div className="mt-2.5 h-2.5 w-[76%] rounded-full bg-bg-soft-200/60" />
          </div>
        </div>
      ))}
    </Column>
  );
}

/** The whole page, for the route-level loading boundary. */
export function DigestSkeleton() {
  const today = toDayString();

  return (
    <>
      <div className="safe-top border-b border-stroke-soft-200 bg-bg-white-0">
        <Column className="pb-4 md:pb-5 md:pt-2">
          <WeekRail week={railDays(anchoredWindow(today), today, today)} />
          <div className="mt-4 flex items-center justify-between gap-3 md:mt-5">
            <span className="h-8 w-40 rounded-lg bg-bg-weak-50 md:h-11 md:w-64" />
            <span className="h-8 w-[124px] shrink-0 rounded-lg bg-bg-weak-50" />
          </div>
        </Column>
      </div>
      {/* Same treatment as a cold start inside the app, so the hand-off from
          this boundary to the live client is invisible. */}
      <div className="relative flex flex-1 flex-col">
        <div className="flex flex-1 flex-col">
          <DaySkeleton />
        </div>
        <DigestingOverlay />
      </div>
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
        </header>

        <div className="animate-pulse pb-16 pt-3">
          <div className="h-5 w-20 rounded-full bg-bg-weak-50" />
          <div className="mt-3 h-6 w-[78%] rounded-lg bg-bg-weak-50 md:h-8" />

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

