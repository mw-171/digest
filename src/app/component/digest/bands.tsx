"use client";

import { RiArrowDownSLine, RiArrowUpSLine } from "@remixicon/react";
import Link from "next/link";

import { SenderAvatar } from "./avatar-initials";
import * as Accordion from "@/app/component/ui/accordion";
import { eventDateBlock, formatDeadline, formatEventTime } from "@/lib/day";
import { cn } from "@/utils/cn";
import type { DigestItem } from "@/lib/digest";
import { gmailThreadUrl } from "@/lib/gmail-url";

const CARD = cn(
  "relative mb-[7px] flex min-h-[58px] w-full items-center gap-3 rounded-2xl bg-bg-white-0 p-[13px]",
  "md:min-h-[68px] md:gap-4 md:px-5 md:py-4",
  "transition-shadow duration-200 ease-out hover:shadow-regular-xs",
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-alpha-24",
);

/** The date chip. Nothing at all when the message named no date. */
function Deadline({ item, day }: { item: DigestItem; day: string }) {
  const deadline = formatDeadline(item.due, day, item.dueKind);
  if (!deadline) return null;

  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap text-label-xs font-semibold",
        deadline.late ? "text-text-soft-400" : "text-primary-base",
      )}
    >
      {deadline.label}
    </span>
  );
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
      {items.map((item) =>
        item.invite ? (
          <InviteCard key={item.id} item={item} day={day} />
        ) : (
          <MessageCard key={item.id} item={item} day={day} />
        ),
      )}
    </Band>
  );
}

/** The ordinary card: who it is from, what it wants, and by when. */
function MessageCard({ item, day }: { item: DigestItem; day: string }) {
  return (
    <Link href={`/message/${item.id}?date=${day}`} className={cn(CARD, "outline-none")}>
      <SenderAvatar name={item.from} email={item.fromEmail} band={item.band} />
      <span className="min-w-0 flex-1 overflow-hidden md:flex md:items-baseline md:gap-6">
        <span className="block truncate text-label-sm font-semibold text-text-strong-950 md:flex-1 md:text-label-md">
          {item.purpose}
        </span>
        <span className="mt-0.5 flex items-baseline gap-[7px] md:mt-0 md:w-64 md:shrink-0 md:justify-end lg:w-80">
          <span className="truncate text-label-xs text-text-sub-600">
            {item.from}
          </span>
          <Deadline item={item} day={day} />
        </span>
      </span>
    </Link>
  );
}

/**
 * An invitation, which is the one message where the four things you need are
 * never in the subject line: the date, the time, the place, and whether you
 * have answered. So it gets a date block instead of an avatar and a reply row
 * instead of a deadline — while still living in whichever tier its state puts
 * it in, rather than in a calendar section of its own.
 *
 * Accept and Decline open the invitation in Gmail rather than answering here:
 * the app holds a read-only Gmail scope, and RSVP is a write.
 */
function InviteCard({ item, day }: { item: DigestItem; day: string }) {
  const invite = item.invite!;
  const block = eventDateBlock(invite.start, invite.allDay);
  const unanswered = invite.status === "needs-action" && !invite.cancelled;
  const gmail = gmailThreadUrl(item.threadId || item.id, "");

  return (
    <div className={cn(CARD, "flex-col items-stretch gap-0 py-0 md:py-0")}>
      <div className="flex items-center gap-3 py-[13px] md:gap-4 md:py-4">
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 flex-col items-center justify-center rounded-lg leading-none",
            invite.cancelled
              ? "bg-bg-weak-50 text-text-soft-400"
              : "bg-primary-alpha-10 text-primary-base",
          )}
        >
          <span className="text-label-sm font-semibold">{block.day}</span>
          <span className="mt-0.5 text-[9px] uppercase tracking-[0.08em]">
            {block.month}
          </span>
        </span>

        <span className="min-w-0 flex-1 overflow-hidden">
          {/* Stretched so the whole card opens the message, without nesting a
              link inside a link the way a wrapping <a> would. */}
          <Link
            href={`/message/${item.id}?date=${day}`}
            className="block truncate text-label-sm font-semibold text-text-strong-950 outline-none after:absolute after:inset-0 focus-visible:underline md:text-label-md"
          >
            {invite.cancelled && "Cancelled: "}
            {invite.summary || item.purpose}
          </Link>
          <span className="mt-0.5 flex items-baseline gap-[7px] text-label-xs text-text-sub-600">
            <span className="truncate">
              {formatEventTime(invite.start, invite.allDay)}
              {invite.location && ` · ${invite.location}`}
            </span>
          </span>
        </span>

        {!unanswered && !invite.cancelled && invite.status !== "unknown" && (
          <span className="shrink-0 text-label-xs text-text-soft-400">
            {invite.status === "accepted"
              ? "Going"
              : invite.status === "declined"
                ? "Not going"
                : "Maybe"}
          </span>
        )}
      </div>

      {unanswered && (
        <div className="relative z-10 flex gap-2 border-t border-stroke-soft-200 py-2.5">
          <a
            href={gmail}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-primary-base px-3 py-1.5 text-label-xs font-semibold text-static-white outline-none hover:bg-primary-darker focus-visible:ring-2 focus-visible:ring-primary-alpha-24"
          >
            Accept
          </a>
          <a
            href={gmail}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg px-3 py-1.5 text-label-xs font-semibold text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200 outline-none hover:bg-bg-weak-50 focus-visible:ring-2 focus-visible:ring-primary-alpha-24"
          >
            Decline
          </a>
          <span className="ml-auto self-center text-label-xs text-text-soft-400">
            Replies open in Gmail
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Noise: one dim row at the bottom of the page, carrying nothing but a count
 * until it is tapped. These messages were never read — Gmail's labels put them
 * here, and only their headers were ever fetched — so a sender and a subject
 * is all there is to show.
 */
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
