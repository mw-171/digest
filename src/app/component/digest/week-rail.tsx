"use client";

import Link from "next/link";

import { cn } from "@/utils/cn";
import type { WeekDay } from "@/lib/digest";

/**
 * The week as a rail of seven pills.
 *
 * The bars this replaces spent their height saying how busy a day was, which
 * is a fact worth one glance and never worth the third of the screen it cost.
 * Here the day is the pill and the volume is the pip underneath it: present or
 * absent, heavy or light, and nothing taller than 3px.
 */
export function WeekRail({
  week,
  onSelect,
}: {
  week: WeekDay[];
  /** Supplied by the live digest so a tap reads the query cache instead of
   *  navigating; without it the pills fall back to plain links. */
  onSelect?: (day: string) => void;
}) {
  const Element = (onSelect ? "button" : Link) as React.ElementType;

  return (
    <div className="flex gap-[3px] rounded-2xl bg-bg-weak-50 p-1">
      {week.map((day) => (
        <Element
          key={day.day}
          {...(onSelect
            ? { onClick: () => onSelect(day.day), type: "button" as const }
            : { href: `/?date=${day.day}` })}
          aria-current={day.selected ? "date" : undefined}
          aria-label={`${day.count} on ${day.day}`}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 rounded-xl px-0 py-[7px] outline-none",
            "transition-colors duration-200 ease-out",
            "focus-visible:ring-2 focus-visible:ring-primary-alpha-24",
            day.selected
              ? "bg-bg-strong-950"
              : "hover:bg-bg-white-0 md:py-2.5",
          )}
        >
          <span
            className={cn(
              "text-[9.5px] font-semibold uppercase tracking-[0.06em] md:text-label-xs",
              day.selected ? "text-text-white-0/60" : "text-text-soft-400",
            )}
          >
            {day.weekday}
          </span>
          <span
            className={cn(
              "text-label-sm font-semibold tracking-[-0.02em] md:text-label-md",
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
              one at half, an empty one not at all. */}
          <span
            className={cn(
              "h-[3px] w-3.5 rounded-sm md:w-5",
              day.selected
                ? "bg-text-white-0/50"
                : day.count
                  ? "bg-bg-sub-300"
                  : "bg-transparent",
              day.count && day.weight <= 0.6 && "opacity-55",
            )}
          />
        </Element>
      ))}
    </div>
  );
}
