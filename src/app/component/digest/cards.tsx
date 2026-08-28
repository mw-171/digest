"use client";

import { RiAiGenerateText, RiReplyLine } from "@remixicon/react";
import Link from "next/link";
import * as React from "react";

import { SenderAvatar } from "./avatar-initials";
import { CATEGORY_STYLE } from "./categories";
import {
  eventDateBlock,
  formatDeadline,
  formatEventTime,
  replyBy,
  clockTime,
} from "@/lib/day";
import { participantLabel, threadsOf, type Thread } from "@/lib/grouping";
import { cn } from "@/utils/cn";
import type { DigestItem } from "@/lib/digest";
import { gmailThreadUrl } from "@/lib/gmail-url";

/** No colour of its own: category lives on the ring around the sender's face. */
const CARD = cn(
  "relative mb-[7px] flex min-h-[58px] w-full items-center gap-3.5 rounded-2xl bg-bg-white-0 p-[13px]",
  "md:min-h-[68px] md:gap-4 md:px-5 md:py-4",
  "transition-shadow duration-200 ease-out hover:shadow-regular-xs",
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-alpha-24",
);

// One value, never two: reply-by date, then that a reply is owed, then the
// time. An event's date is not among them — that is when, not a reason to act.
function Corner({
  item,
  day,
  showTime,
}: {
  item: DigestItem;
  day: string;
  showTime: boolean;
}) {
  if (item.needsReply) {
    // Only a deadline earns a date here; `dueKind` tells the two apart.
    const label =
      (item.dueKind === "deadline" ? replyBy(item.due, day) : null) ??
      "Needs reply";

    return (
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-bg-weak-50 px-2 py-0.5 text-label-xs font-medium text-text-sub-600">
        <RiReplyLine aria-hidden className="size-3 shrink-0" />
        {label}
      </span>
    );
  }

  if (!showTime) return null;
  const time = clockTime(item.receivedAt);
  if (!time) return null;

  return (
    <time
      dateTime={item.receivedAt}
      className="shrink-0 whitespace-nowrap text-label-xs font-medium text-text-soft-400"
    >
      {time}
    </time>
  );
}

// Urgency on the face, not the corner: it is independent of needing a reply,
// so the two can coexist. The border is the card's colour, so it reads on top.
function Face({ item }: { item: DigestItem }) {
  return (
    <span className="relative shrink-0">
      <SenderAvatar
        name={item.from}
        email={item.fromEmail}
        category={item.category}
      />
      {item.urgency === "high" && (
        <span
          title="Needs you today or tomorrow"
          aria-label="Urgent"
          className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-bg-white-0 bg-error-base text-[9px] font-bold leading-none text-static-white"
        >
          !
        </span>
      )}
    </span>
  );
}

/** Sender first: in a list of forty the question is "who" before "what". */
function CardBody({
  sender,
  href,
  blurb,
  count,
  trailing,
  compact = false,
  read = false,
  children,
}: {
  sender: string;
  /** Where the card goes. Carried by the name, stretched over the whole card. */
  href: string;
  blurb: string;
  count?: number;
  trailing?: React.ReactNode;
  compact?: boolean;
  /** Read mail steps back so unread carries the weight. */
  read?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <span className="min-w-0 flex-1 overflow-hidden">
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {/* The link cannot wrap the card: a card with a second action on it
              would then be a button inside an anchor. So the name is the link
              and its `::after` covers everything behind the rest. */}
          <Link
            href={href}
            className={cn(
              "truncate text-label-sm outline-none md:text-label-md",
              "after:absolute after:inset-0 focus-visible:underline",
              read
                ? "font-medium text-text-sub-600"
                : "font-semibold text-text-strong-950",
            )}
          >
            {sender}
          </Link>
          {count !== undefined && (
            <span className="shrink-0 text-label-xs font-medium tabular-nums text-text-soft-400">
              · {count}
            </span>
          )}
        </span>
        {trailing}
      </span>

      {children ?? (
        <span
          className={cn(
            "mt-0.5 block text-label-xs leading-snug text-text-sub-600 [overflow-wrap:anywhere] md:mt-1 md:line-clamp-1 md:text-label-sm",
            compact ? "line-clamp-1" : "line-clamp-2",
          )}
        >
          {blurb}
        </span>
      )}
    </span>
  );
}

/**
 * Writes the reply for you, in the voice read off your own sent mail. A link
 * rather than a button: it opens the message, where the draft is written and
 * shown. It sits beside the state pill because that is where the card says a
 * reply is owed, and this is the one thing you can do about it.
 */
function DraftLink({ item, day }: { item: DigestItem; day: string }) {
  return (
    <Link
      href={`/message/${item.id}?date=${day}&draft=1`}
      className={cn(
        // Above the name's stretched link, which covers the whole card: a tap
        // here belongs to this chip and never opens the message behind it.
        "relative z-10 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full",
        "bg-primary-alpha-10 px-2 py-0.5 text-label-xs font-medium text-primary-base",
        // The chip is the pill's height so the two read as one row. The
        // pseudo-element is the 44px a thumb needs, and it grows away from the
        // pill so a tap meant for one is never answered by the other.
        "after:absolute after:-inset-y-3 after:left-0 after:-right-2",
        "touch-manipulation outline-none transition-colors duration-200 ease-out",
        "hover:bg-primary-alpha-16 focus-visible:ring-2 focus-visible:ring-primary-alpha-24",
      )}
    >
      <RiAiGenerateText aria-hidden className="size-3.5 shrink-0" />
      Draft
      {/* Read out as "Draft a reply to Marcus Lin", so the name a screen
          reader hears still starts with the word on screen. */}
      <span className="sr-only"> a reply to {item.from}</span>
    </Link>
  );
}

/**
 * The end of the top line: what state the message is in, then the one thing
 * the card lets you do about it.
 */
function Trailing({
  item,
  day,
  showTime,
}: {
  item: DigestItem;
  day: string;
  showTime: boolean;
}) {
  const corner = <Corner item={item} day={day} showTime={showTime} />;
  if (!item.needsReply) return corner;

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {corner}
      <DraftLink item={item} day={day} />
    </span>
  );
}

function MessageCard({
  item,
  day,
  showTime,
  compact,
}: {
  item: DigestItem;
  day: string;
  showTime: boolean;
  compact: boolean;
}) {
  return (
    <div className={CARD}>
      <Face item={item} />
      <CardBody
        sender={item.from}
        href={`/message/${item.id}?date=${day}`}
        blurb={item.blurb || item.purpose}
        compact={compact}
        read={!item.unread}
        trailing={<Trailing item={item} day={day} showTime={showTime} />}
      />
    </div>
  );
}

/** A conversation as one card. Opens on the newest message. */
function ThreadCard({
  thread,
  day,
  showTime,
  compact,
}: {
  thread: Thread;
  day: string;
  showTime: boolean;
  compact: boolean;
}) {
  const latest = thread.latest;

  return (
    <div className={CARD}>
      <Face item={latest} />
      <CardBody
        sender={participantLabel(thread.participants)}
        href={`/message/${latest.id}?date=${day}`}
        blurb={latest.blurb || thread.subject}
        // Two is just a reply; a conversation starts being one at three.
        count={thread.count >= 3 ? thread.count : undefined}
        compact={compact}
        read={!latest.unread}
        trailing={<Trailing item={latest} day={day} showTime={showTime} />}
      />
    </div>
  );
}

// Date block instead of an avatar, reply row instead of a deadline. Accept and
// Decline open Gmail: RSVP is a write and this app is read-only.
function InviteCard({ item, day }: { item: DigestItem; day: string }) {
  const invite = item.invite!;
  const block = eventDateBlock(invite.start, invite.allDay);
  const unanswered = invite.status === "needs-action" && !invite.cancelled;
  const gmail = gmailThreadUrl(item.threadId || item.id, "");

  return (
    <div className={cn(CARD, "flex-col items-stretch gap-0 py-0 md:py-0")}>
      <div className="flex items-center gap-3.5 py-[13px] md:gap-4 md:py-4">
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 flex-col items-center justify-center rounded-lg leading-none",
            invite.cancelled
              ? "bg-bg-weak-50 text-text-soft-400"
              : "bg-blue-alpha-10 text-blue-700",
          )}
        >
          <span className="text-label-sm font-semibold">{block.day}</span>
          <span className="mt-0.5 text-[9px] uppercase tracking-[0.08em]">
            {block.month}
          </span>
        </span>

        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="flex items-center justify-between gap-2">
            {/* Stretched, so the whole card opens it without nesting links. */}
            <Link
              href={`/message/${item.id}?date=${day}`}
              className="truncate text-label-sm font-semibold text-text-strong-950 outline-none after:absolute after:inset-0 focus-visible:underline md:text-label-md"
            >
              {invite.cancelled && "Cancelled: "}
              {invite.summary || item.purpose}
            </Link>
            {!unanswered &&
              !invite.cancelled &&
              invite.status !== "unknown" && (
                <span className="shrink-0 text-label-xs text-text-soft-400">
                  {invite.status === "accepted"
                    ? "Going"
                    : invite.status === "declined"
                      ? "Not going"
                      : "Maybe"}
                </span>
              )}
          </span>
          <span className="mt-0.5 block truncate text-label-xs text-text-sub-600 md:mt-1 md:text-label-sm">
            {formatEventTime(invite.start, invite.allDay)}
            {invite.location && ` · ${invite.location}`}
          </span>
        </span>
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
            className="rounded-lg px-3 py-1.5 text-label-xs font-semibold text-text-sub-600 outline-none ring-1 ring-inset ring-stroke-soft-200 hover:bg-bg-weak-50 focus-visible:ring-2 focus-visible:ring-primary-alpha-24"
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

function ThreadEntry({
  thread,
  day,
  showTime,
  compact,
}: {
  thread: Thread;
  day: string;
  showTime: boolean;
  compact: boolean;
}) {
  if (thread.count > 1)
    return (
      <ThreadCard
        thread={thread}
        day={day}
        showTime={showTime}
        compact={compact}
      />
    );
  // An invite shows its event's time, not when the mail arrived.
  if (thread.latest.invite)
    return <InviteCard item={thread.latest} day={day} />;
  return (
    <MessageCard
      item={thread.latest}
      day={day}
      showTime={showTime}
      compact={compact}
    />
  );
}

/** A stack of cards, threaded. Threading reorders nothing on its own. */
export function CardList({
  items,
  day,
  showTime = false,
  compact = false,
}: {
  items: DigestItem[];
  day: string;
  showTime?: boolean;
  compact?: boolean;
}) {
  return (
    <>
      {threadsOf(items).map((thread) => (
        <ThreadEntry
          key={thread.id}
          thread={thread}
          day={day}
          showTime={showTime}
          compact={compact}
        />
      ))}
    </>
  );
}

// Cards like every other lane, and no heading: no other lane gets one. Blurbs
// stay one line because these are scanned rather than read.
export function SocialCards({
  items,
  day,
  showTime = false,
}: {
  items: DigestItem[];
  day: string;
  showTime?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <CardList items={items} day={day} compact showTime={showTime} />
    </section>
  );
}
