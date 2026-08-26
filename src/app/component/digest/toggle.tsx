"use client";

import { cn } from "@/utils/cn";

/** Small AlignUI-flavoured switch used for the two digest settings. */
export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="group flex items-center gap-2 outline-none"
    >
      <span
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors duration-200 ease-out",
          "group-focus-visible:ring-2 group-focus-visible:ring-primary-alpha-24",
          value ? "bg-primary-base" : "bg-bg-soft-200",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3 rounded-full bg-static-white shadow-regular-xs",
            "transition-[left] duration-200 ease-out",
            value ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
      <span
        className={cn(
          "whitespace-nowrap text-label-xs transition-colors duration-200",
          value ? "text-text-sub-600" : "text-text-soft-400",
        )}
      >
        {label}
      </span>
    </button>
  );
}
