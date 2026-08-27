"use client";

import { RiCheckLine, RiEqualizer2Line, RiReplyLine } from "@remixicon/react";

import { CATEGORY_STYLE } from "./categories";
import * as Dropdown from "@/app/component/ui/dropdown";
import { cn } from "@/utils/cn";
import type { Category } from "@/lib/digest-ai";
import type { CategoryGroup } from "@/lib/digest";

/** "priority" is Claude's ranking; "recent" is the mailbox's. */
export type SortMode = "priority" | "recent";

export const SORT_LABEL: Record<SortMode, string> = {
  priority: "Priority",
  recent: "Recent",
};

const SORT_HINT: Record<SortMode, string> = {
  priority: "Action items and near meetings first",
  recent: "Newest mail first",
};

/** The day as one bar, and the legend for every colour further down. */
export function VolumeBar({
  categories,
  focus,
  onFocus,
}: {
  categories: CategoryGroup[];
  focus: Category | null;
  onFocus: (next: Category | null) => void;
}) {
  const shown = categories.filter((group) => group.count > 0);
  if (shown.length === 0) return null;

  return (
    <div className="flex gap-[3px]">
      {shown.map((group) => {
        const active = focus === group.key;

        return (
          <button
            key={group.key}
            type="button"
            style={{ flexGrow: group.count }}
            onClick={() => onFocus(active ? null : group.key)}
            aria-pressed={active}
            aria-label={`${group.title}, ${group.count}`}
            // 8px is under a thumb; padding pulled back out by a negative
            // margin gives a 24px target without thickening the bar.
            className="group -my-2 shrink-0 py-2 outline-none"
          >
            <span
              className={cn(
                "block h-2 rounded transition-opacity duration-200 ease-out",
                CATEGORY_STYLE[group.key].swatch,
                // Too thin for a ring, so a filter shows by dimming the rest.
                focus !== null && !active && "opacity-30",
                "group-hover:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-primary-alpha-24",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/** A tile is a toggle: it filters the list rather than navigating. */
function Tile({
  group,
  active,
  onToggle,
}: {
  group: CategoryGroup;
  active: boolean;
  onToggle: () => void;
}) {
  const style = CATEGORY_STYLE[group.key];
  const empty = group.count === 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={empty}
      aria-pressed={active}
      className={cn(
        "flex h-[88px] flex-col justify-between rounded-2xl p-3 text-left outline-none md:h-[100px] md:p-4",
        "ring-inset transition-[background-color,box-shadow] duration-200 ease-out",
        "focus-visible:ring-2 focus-visible:ring-primary-alpha-24",
        active
          ? "bg-bg-white-0 ring-2 ring-stroke-strong-950"
          : "bg-bg-weak-50 hover:bg-bg-white-0 hover:ring-1 hover:ring-stroke-soft-200",
        empty && "opacity-45 hover:bg-bg-weak-50 hover:ring-0",
      )}
    >
      <span className={cn("size-2.5 rounded-[3px]", style.swatch)} />

      <span className="block">
        <span className="block text-title-h5 font-semibold tabular-nums leading-none tracking-[-0.04em] text-text-strong-950 md:text-title-h4">
          {group.count}
        </span>
        <span className="mt-1 flex items-baseline gap-1.5">
          <span className="text-label-xs font-medium text-text-sub-600 md:text-label-sm">
            {group.title}
          </span>
          {/* Waiting on a reply. An icon, not `↩` — iOS renders that as emoji. */}
          {group.replies > 0 && (
            <span
              title={`${group.replies} waiting on a reply`}
              className="inline-flex items-center gap-0.5 text-label-xs font-semibold tabular-nums text-primary-base"
            >
              {group.replies}
              <RiReplyLine aria-hidden className="size-3" />
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/** Always all four, so the grid never changes shape. */
export function Tiles({
  categories,
  focus,
  onFocus,
}: {
  categories: CategoryGroup[];
  focus: Category | null;
  onFocus: (next: Category | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
      {categories.map((group) => (
        <Tile
          key={group.key}
          group={group}
          active={focus === group.key}
          onToggle={() => onFocus(focus === group.key ? null : group.key)}
        />
      ))}
    </div>
  );
}

function SortOption({
  mode,
  current,
  onPick,
}: {
  mode: SortMode;
  current: SortMode;
  onPick: (next: SortMode) => void;
}) {
  const active = mode === current;

  return (
    <Dropdown.Item
      onSelect={() => onPick(mode)}
      className="items-start gap-2.5"
    >
      <RiCheckLine
        className={cn(
          "mt-0.5 size-4 shrink-0 text-primary-base",
          !active && "invisible",
        )}
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-label-sm font-medium text-text-strong-950">
          {SORT_LABEL[mode]}
        </span>
        <span className="text-label-xs text-text-soft-400">
          {SORT_HINT[mode]}
        </span>
      </span>
    </Dropdown.Item>
  );
}

/** Names whatever the tiles left, and carries the sort control. */
export function FocusRule({
  label,
  count,
  filtered,
  onClear,
  sort,
  onSort,
}: {
  label: string;
  count?: number;
  filtered: boolean;
  onClear: () => void;
  sort: SortMode;
  onSort: (next: SortMode) => void;
}) {
  return (
    <div className="flex items-center gap-2 pb-2 pt-6">
      <span className="text-label-xs font-semibold uppercase tracking-[0.04em] text-text-strong-950">
        {label}
      </span>
      {count !== undefined && (
        <span className="text-label-xs font-semibold tabular-nums text-text-soft-400">
          {count}
        </span>
      )}
      <span className="h-px flex-1 bg-stroke-soft-200" />

      {filtered && (
        <button
          type="button"
          onClick={onClear}
          className="rounded text-label-xs font-medium text-text-soft-400 outline-none hover:text-text-sub-600 focus-visible:ring-2 focus-visible:ring-primary-alpha-24"
        >
          Clear filter
        </button>
      )}

      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <button
            type="button"
            aria-label={`Sort by ${SORT_LABEL[sort].toLowerCase()}`}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 outline-none",
              "text-label-xs font-medium text-text-sub-600",
              "transition-colors duration-200 ease-out hover:bg-bg-weak-50",
              "focus-visible:ring-2 focus-visible:ring-primary-alpha-24",
              "data-[state=open]:bg-bg-weak-50",
            )}
          >
            <RiEqualizer2Line className="size-3.5 shrink-0" />
            {SORT_LABEL[sort]}
          </button>
        </Dropdown.Trigger>

        <Dropdown.Content align="end" className="w-[248px]">
          <Dropdown.Label>Sort by</Dropdown.Label>
          <SortOption mode="priority" current={sort} onPick={onSort} />
          <SortOption mode="recent" current={sort} onPick={onSort} />
        </Dropdown.Content>
      </Dropdown.Root>
    </div>
  );
}

// Quieter than {@link FocusRule} on purpose: the end of the important part,
// not the start of another section.
export function QuietRule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 pt-6">
      <span className="text-label-xs font-medium text-text-soft-400">
        {label}
      </span>
      <span className="h-px flex-1 bg-stroke-soft-200" />
    </div>
  );
}
