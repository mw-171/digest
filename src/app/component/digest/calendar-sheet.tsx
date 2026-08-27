"use client";

import { RiArrowDownSLine, RiCloseLine } from "@remixicon/react";
import { useRouter } from "next/navigation";
import * as React from "react";

import * as Button from "@/app/component/ui/button";
import * as CompactButton from "@/app/component/ui/compact-button";
import { Calendar } from "@/app/component/ui/datepicker";
import * as Modal from "@/app/component/ui/modal";
import { toDayString } from "@/lib/day";

/** The month pill in the header; opens the AlignUI datepicker to jump days. */
export function CalendarSheet({
  day,
  label,
  onSelect,
}: {
  day: string;
  label: string;
  onSelect?: (day: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const today = new Date(`${toDayString()}T00:00:00`);

  return (
    <Modal.Root open={open} onOpenChange={setOpen}>
      <Modal.Trigger asChild>
        <Button.Root variant="neutral" mode="stroke" size="xsmall">
          {label}
          <Button.Icon as={RiArrowDownSLine} />
        </Button.Root>
      </Modal.Trigger>

      {/*
        The kit's own close button is absolutely placed at `top-4 right-4`,
        which on a bare calendar lands on top of the next-month chevron and
        ten pixels above the month bar it appears to belong to. This sheet
        supplies its own header instead, so the button is aligned by the row
        it sits in rather than by an offset that happens to suit a modal with
        a title in it.
      */}
      <Modal.Content
        showClose={false}
        className="max-w-[368px] overflow-hidden"
        // A calendar needs no prose description; without this Radix warns.
        aria-describedby={undefined}
      >
        <div className="flex items-center justify-between gap-3 border-b border-stroke-soft-200 px-5 py-3">
          <Modal.Title>Jump to a date</Modal.Title>
          <Modal.Close asChild>
            <CompactButton.Root variant="ghost" size="large" aria-label="Close">
              <CompactButton.Icon as={RiCloseLine} />
            </CompactButton.Root>
          </Modal.Close>
        </div>

        <Calendar
          mode="single"
          selected={new Date(`${day}T00:00:00`)}
          defaultMonth={new Date(`${day}T00:00:00`)}
          disabled={{ after: today }}
          onSelect={(date) => {
            if (!date) return;
            setOpen(false);
            const picked = toDayString(date);
            if (onSelect) onSelect(picked);
            else router.push(`/?date=${picked}`);
          }}
        />
      </Modal.Content>
    </Modal.Root>
  );
}
