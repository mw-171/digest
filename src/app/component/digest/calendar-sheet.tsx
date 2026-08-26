"use client";

import { RiArrowDownSLine } from "@remixicon/react";
import { useRouter } from "next/navigation";
import * as React from "react";

import * as Button from "@/app/component/ui/button";
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
      <Modal.Content className="max-w-[352px]">
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
