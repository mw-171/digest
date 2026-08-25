"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

function shift(day: string, days: number) {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function DayPicker({ day, today }: { day: string; today: string }) {
  const router = useRouter();
  const [value, setValue] = useState(day);
  const [isPending, startTransition] = useTransition();

  // Keep the input in sync when the day changes from outside (e.g. back button).
  useEffect(() => setValue(day), [day]);

  function go(next: string) {
    if (!next) return;
    setValue(next);
    startTransition(() => router.push(`/?date=${next}`));
  }

  const button =
    "rounded-10 border border-stroke-soft-200 px-2.5 py-1.5 text-text-sub-600 hover:bg-bg-weak-50 disabled:opacity-40";

  return (
    <div
      className="flex items-center gap-2 text-sm"
      data-pending={isPending ? "" : undefined}
    >
      <button type="button" className={button} onClick={() => go(shift(value, -1))}>
        ←
      </button>
      <input
        type="date"
        value={value}
        max={today}
        onChange={(event) => go(event.target.value)}
        className="rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 py-1.5 text-text-strong-950"
      />
      <button
        type="button"
        className={button}
        onClick={() => go(shift(value, 1))}
        disabled={value >= today}
      >
        →
      </button>
      {value !== today && (
        <button type="button" className={button} onClick={() => go(today)}>
          Today
        </button>
      )}
      {isPending && <span className="text-text-soft-400">loading…</span>}
    </div>
  );
}
