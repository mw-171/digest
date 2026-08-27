// AlignUI Datepicker v0.0.0
// Migrated to react-day-picker v9: renamed classNames keys, `navLayout="around"`
// for the arrows, and `Chevron` in place of `IconLeft`/`IconRight`. In v9
// `aria-selected` and the state classes live on the day cell (`td`), so the
// button styles hang off `group/day`.
//
// With `navLayout="around"` v9 renders the two arrows as *siblings* of the
// caption inside the month, not as children of it. They used to be absolutely
// positioned as though the caption contained them, which left them anchored to
// whatever ancestor happened to be positioned — in a modal, the modal — and
// landed them on top of the date grid. The month is a three-column grid now,
// so the arrows sit in the header row by layout and cannot drift.

"use client";

import * as React from "react";
import {
  RiArrowDownSLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiArrowUpSLine,
} from "@remixicon/react";
import { DayPicker } from "react-day-picker";

import { compactButtonVariants } from "./compact-button";
import { cn } from "@/utils/cn";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/** An arrow in the caption bar: square, flush with it, and part of its fill. */
const navButton = compactButtonVariants({
  variant: "ghost",
  size: "large",
}).root({
  class:
    "size-9 shrink-0 rounded-none bg-bg-weak-50 text-text-sub-600 hover:bg-bg-soft-200 disabled:text-text-disabled-300 aria-disabled:pointer-events-none aria-disabled:text-text-disabled-300",
});

function Calendar({
  classNames,
  showOutsideDays = true,
  // Months run four to six week-rows; without this the panel grows and shrinks
  // by a row as you page through them, which in a modal moves the whole dialog
  // under the cursor. Six rows always, padded from the neighbouring months.
  fixedWeeks = true,
  ...rest
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      fixedWeeks={fixedWeeks}
      navLayout="around"
      classNames={{
        months: "flex divide-x divide-stroke-soft-200",
        // Header row is [arrow | month year | arrow]; the grid spans all three.
        month: "grid grid-cols-[auto_1fr_auto] items-center gap-y-2 p-5",
        // Rounding lives on the two arrows, so the three cells read as one bar.
        month_caption: "flex h-9 items-center justify-center bg-bg-weak-50",
        caption_label: "text-label-sm text-text-sub-600 select-none",
        button_previous: cn(navButton, "rounded-l-lg"),
        button_next: cn(navButton, "rounded-r-lg"),
        month_grid: "col-span-3 w-full border-collapse",
        weekdays: "flex gap-2",
        weekday:
          "text-text-soft-400 text-label-sm uppercase size-10 flex items-center justify-center text-center select-none",
        week: "grid grid-flow-col auto-cols-auto w-full mt-2 gap-2",
        day: cn(
          // base
          "group/day relative size-10 shrink-0 select-none p-0",
          // rounded ends of a range
          "first:aria-selected:rounded-l-lg last:aria-selected:rounded-r-lg",
          // bar that fills the gap between cells; shown by the range classes
          "before:absolute before:inset-y-0 before:-right-2 before:hidden before:w-2 before:bg-primary-alpha-10",
          "last:before:hidden",
        ),
        day_button: cn(
          // base
          "flex size-10 shrink-0 items-center justify-center rounded-lg text-center text-label-sm text-text-sub-600 outline-none",
          "transition duration-200 ease-out",
          // hover
          "hover:bg-bg-weak-50 hover:text-text-strong-950",
          // selected
          "group-aria-selected/day:bg-primary-base group-aria-selected/day:text-static-white",
          // middle of a range keeps the cell's tint instead
          "group-[.day-range-middle]/day:!bg-transparent group-[.day-range-middle]/day:!text-primary-base",
          // outside / disabled
          "group-[.day-outside]/day:text-text-disabled-300 group-[.day-outside]/day:group-aria-selected/day:!text-static-white",
          "group-[.day-disabled]/day:!text-text-disabled-300",
          // focus visible
          "focus:outline-none focus-visible:bg-bg-weak-50 focus-visible:text-text-strong-950",
        ),
        range_start: "day-range-start before:block before:w-3",
        range_end:
          "day-range-end before:left-0 before:right-auto [&:not(:first-child)]:before:block",
        range_middle: "day-range-middle bg-primary-alpha-10 before:block",
        selected: "day-selected",
        today: "day-today",
        outside: "day-outside",
        disabled: "day-disabled",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon =
            orientation === "left"
              ? RiArrowLeftSLine
              : orientation === "up"
                ? RiArrowUpSLine
                : orientation === "down"
                  ? RiArrowDownSLine
                  : RiArrowRightSLine;
          return <Icon className="size-5" />;
        },
      }}
      {...rest}
    />
  );
}

export { Calendar };
