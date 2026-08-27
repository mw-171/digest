"use client";

import Link from "next/link";

import { cn } from "@/utils/cn";
import type { RailDay } from "@/lib/day";

/** Gap between pills, in px. The indicator has to travel it too. */
const GAP = 3;

/** A pill, with its volume if the counts have arrived yet. */
export type RailEntry = RailDay & { count?: number; weight?: number };

/**
 * The week as a rail of pills.
 *
 * The bars this replaces spent their height saying how busy a day was, which
 * is a fact worth one glance and never worth the third of the screen it cost.
 * Here the day is the pill and the volume is the pip underneath it: present or
 * absent, heavy or light, and nothing taller than 3px.
 *
 * The window is fixed — it ends today unless you reach past it — so a pill's
 * position means something, and the selection can travel between them instead
 * of the rail sliding underneath.
 */
export function WeekRail({
  week,
  onSelect,
}: {
  week: RailEntry[];
  /** Supplied by the live digest so a tap reads the query cache instead of
   *  navigating; without it the pills fall back to plain links. */
  onSelect?: (day: string) => void;
}) {
  const Element = (onSelect ? "button" : Link) as React.ElementType;
  const selected = week.findIndex((day) => day.selected);
  const n = week.length;

  return (
    <div className="relative flex gap-[3px] rounded-2xl bg-bg-weak-50 p-1">
      {/*
        One pill-shaped block that slides, rather than a background switched on
        and off per pill. Its width is a pill's, so a step is one width plus the
        gap it crosses. Transform only, so it never reflows the row beneath.
      */}
      {selected >= 0 && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-1 left-1 rounded-xl bg-bg-strong-950",
            "transition-transform duration-300 ease-out motion-reduce:transition-none",
          )}
          style={{
            width: `calc((100% - 0.5rem - ${(n - 1) * GAP}px) / ${n})`,
            transform: `translateX(calc(${selected} * (100% + ${GAP}px)))`,
          }}
        />
      )}

      {week.map((day) => (
        <Element
          key={day.day}
          {...(onSelect
            ? { onClick: () => onSelect(day.day), type: "button" as const }
            : { href: `/?date=${day.day}` })}
          aria-current={day.selected ? "date" : undefined}
          aria-label={
            day.count === undefined ? day.day : `${day.count} on ${day.day}`
          }
          className={cn(
            "relative flex flex-1 flex-col items-center gap-1 rounded-xl px-0 py-[7px] outline-none",
            "focus-visible:ring-2 focus-visible:ring-primary-alpha-24",
            !day.selected && "hover:bg-bg-white-0/70",
            "md:py-2.5",
          )}
        >
          <span
            // Locale-formatted, so the server's rendering of it is a guess at
            // the reader's. The browser's answer replaces it on the next
            // render rather than being flagged as a mismatch.
            suppressHydrationWarning
            className={cn(
              "text-[9.5px] font-semibold uppercase tracking-[0.06em] transition-colors duration-300 ease-out md:text-label-xs",
              day.selected ? "text-text-white-0/60" : "text-text-soft-400",
            )}
          >
            {day.weekday}
          </span>
          <span
            suppressHydrationWarning
            className={cn(
              "text-label-sm font-semibold tracking-[-0.02em] transition-colors duration-300 ease-out md:text-label-md",
              day.selected
                ? "text-text-white-0"
                : day.count
                  ? "text-text-strong-950"
                  : "text-text-disabled-300",
            )}
          >
            {day.date}
          </span>
          {/* Volume, in the only two dimensions a 3px bar has: is there any,
              and is there a lot. A busy day reads at full strength, a quiet
              one at half, an empty one not at all. Before the counts land it
              sits at a third — the pill is already its final size, so this is
              the only thing that changes when they do. */}
          <span
            className={cn(
              "h-[3px] w-3.5 rounded-sm transition-colors duration-300 ease-out md:w-5",
              day.selected
                ? "bg-text-white-0/50"
                : day.count === undefined
                  ? "bg-bg-sub-300/30"
                  : day.count
                    ? "bg-bg-sub-300"
                    : "bg-transparent",
              day.count !== undefined &&
                day.count > 0 &&
                day.weight !== undefined &&
                day.weight <= 0.6 &&
                "opacity-55",
            )}
          />
        </Element>
      ))}
    </div>
  );
}
