"use client";

import Link from "next/link";

import { cn } from "@/utils/cn";
import type { WeekDay } from "@/lib/digest";

/**
 * The week as volume bars — the taller the bar, the more mail arrived. Bar
 * heights come from the data as a `--bar` custom property so the whole chart
 * can scale up on wider screens without recomputing anything.
 */
export function WeekStrip({
  week,
  onSelect,
}: {
  week: WeekDay[];
  /** Supplied by the live digest so a tap reads the query cache instead of
   *  navigating; without it the bars fall back to plain links. */
  onSelect?: (day: string) => void;
}) {
  const Element = (onSelect ? "button" : Link) as React.ElementType;

  return (
    <div className="mt-4 flex items-end gap-1.5 md:mt-0 md:w-[340px] md:shrink-0 md:gap-2 lg:w-[420px] lg:gap-3">
      {week.map((day) => (
        <Element
          key={day.day}
          {...(onSelect
            ? { onClick: () => onSelect(day.day), type: "button" as const }
            : { href: `/?date=${day.day}` })}
          aria-current={day.selected ? "date" : undefined}
          aria-label={`${day.count} on ${day.day}`}
          className={cn(
            "group flex flex-1 flex-col items-center gap-[7px] rounded-lg py-1 outline-none",
            "focus-visible:ring-2 focus-visible:ring-primary-alpha-24",
          )}
        >
          <span className="flex h-12 w-full items-end justify-center md:h-[68px]">
            <span
              style={{ "--bar": `${day.height}px` } as React.CSSProperties}
              className={cn(
                "h-[var(--bar)] w-4 rounded-[5px] transition-colors duration-200 ease-out",
                "md:h-[calc(var(--bar)*1.4)] md:w-6 lg:w-8",
                day.selected
                  ? "bg-primary-base"
                  : day.count
                    ? "bg-primary-alpha-24 group-hover:bg-primary-alpha-16"
                    : "bg-bg-soft-200",
              )}
            />
          </span>
          <span
            className={cn(
              "text-label-xs md:text-label-sm",
              day.selected
                ? "font-bold text-text-strong-950"
                : day.isToday
                  ? "font-semibold text-text-sub-600"
                  : "text-text-soft-400",
            )}
          >
            {day.date}
          </span>
          <span className="text-[9.5px] uppercase tracking-[0.08em] text-text-disabled-300">
            {day.weekday}
          </span>
        </Element>
      ))}
    </div>
  );
}
