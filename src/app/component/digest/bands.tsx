"use client";

import { RiArrowDownSLine, RiArrowUpSLine } from "@remixicon/react";
import Link from "next/link";

import { SenderAvatar } from "./avatar-initials";
import * as Accordion from "@/app/component/ui/accordion";
import { cn } from "@/utils/cn";
import type { DigestItem } from "@/lib/digest";

function time(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * One collapsible band, on AlignUI's accordion.
 *
 * The component brings the behaviour — the trigger, the state attribute, the
 * height animation, the arrow that flips — while the classNames unpick its
 * card chrome (ring, fill, padding). A band is a rule across the page, not a
 * panel: the message rows inside are already cards, and a card of cards reads
 * as clutter.
 */
function Band({
  title,
  count,
  muted,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  muted?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Accordion.Root
      type="single"
      collapsible
      defaultValue={defaultOpen ? title : undefined}
      asChild
    >
      <section>
        <Accordion.Item
          value={title}
          className={cn(
            "rounded-none bg-transparent p-0 ring-0",
            "hover:bg-transparent has-[:focus-visible]:bg-transparent",
            "data-[state=open]:bg-transparent",
          )}
        >
          <Accordion.Header>
            <Accordion.Trigger className="m-0 flex w-full items-center gap-2.5 p-0 pb-2.5 pt-5">
              <span
                className={cn(
                  "size-[9px] shrink-0 rounded-[3px]",
                  muted ? "bg-bg-soft-200" : "bg-primary-base",
                )}
              />
              <span
                className={cn(
                  "text-label-xs font-semibold uppercase tracking-[0.05em]",
                  muted ? "text-text-soft-400" : "text-text-strong-950",
                )}
              >
                {title}
              </span>
              <span className="text-label-xs text-text-soft-400">{count}</span>
              <span className="h-px flex-1 bg-stroke-soft-200" />
              <Accordion.Arrow
                openIcon={RiArrowDownSLine}
                closeIcon={RiArrowUpSLine}
                className="size-4 shrink-0"
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="pt-0 text-inherit">
            {children}
          </Accordion.Content>
        </Accordion.Item>
      </section>
    </Accordion.Root>
  );
}

/** One urgency band: a rule-and-count header over a stack of message cards. */
export function BandSection({
  title,
  items,
  day,
  muted,
  defaultOpen = true,
}: {
  title: string;
  items: DigestItem[];
  day: string;
  muted?: boolean;
  defaultOpen?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <Band title={title} count={items.length} muted={muted} defaultOpen={defaultOpen}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/message/${item.id}?date=${day}`}
          className={cn(
            "mb-[7px] flex min-h-[58px] w-full items-center gap-3 rounded-2xl bg-bg-white-0 p-[13px]",
            "md:min-h-[68px] md:gap-4 md:px-5 md:py-4",
            "transition-shadow duration-200 ease-out hover:shadow-regular-xs",
            "outline-none focus-visible:ring-2 focus-visible:ring-primary-alpha-24",
          )}
        >
          <SenderAvatar name={item.from} email={item.fromEmail} band={item.band} />
          <span className="min-w-0 flex-1 overflow-hidden md:flex md:items-baseline md:gap-6">
            <span className="block truncate text-label-sm font-semibold text-text-strong-950 md:flex-1 md:text-label-md">
              {item.purpose}
            </span>
            <span className="mt-0.5 flex items-baseline gap-[7px] md:mt-0 md:w-64 md:shrink-0 md:justify-end lg:w-80">
              <span className="truncate text-label-xs text-text-sub-600">
                {item.from}
              </span>
              {item.when ? (
                <span className="shrink-0 whitespace-nowrap text-label-xs font-semibold text-primary-base">
                  {item.when}
                </span>
              ) : (
                <span className="shrink-0 text-label-xs text-text-soft-400">
                  {time(item.receivedAt)}
                </span>
              )}
            </span>
          </span>
        </Link>
      ))}
    </Band>
  );
}

/** Noise collapses to one line per message — sender, then what it was. */
export function NoiseSection({
  items,
  day,
}: {
  items: DigestItem[];
  day: string;
}) {
  if (items.length === 0) return null;

  return (
    <Band title="NOISE" count={items.length} muted>
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/message/${item.id}?date=${day}`}
          className="flex items-baseline gap-2.5 px-0.5 py-2 outline-none focus-visible:underline md:gap-6 md:py-2.5"
        >
          <span className="shrink-0 text-label-xs text-text-sub-600 md:order-2 md:w-64 md:text-right lg:w-80">
            {item.from}
          </span>
          <span className="min-w-0 truncate text-label-xs text-text-soft-400 md:order-1 md:flex-1">
            {item.purpose}
          </span>
        </Link>
      ))}
    </Band>
  );
}
