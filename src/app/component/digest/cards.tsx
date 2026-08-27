"use client";

import { RiErrorWarningLine, RiReplyLine } from "@remixicon/react";
import Link from "next/link";
import * as React from "react";

import { SenderAvatar } from "./avatar-initials";
import { CATEGORY_STYLE } from "./categories";
import { eventDateBlock, formatDeadline, formatEventTime } from "@/lib/day";
import { participantLabel, threadsOf, type Thread } from "@/lib/grouping";
import { cn } from "@/utils/cn";
import type { DigestItem } from "@/lib/digest";
import { gmailThreadUrl } from "@/lib/gmail-url";

/**
 * Rows inside a collapsed group line up with the text inside a message card
 * rather than with the column's own edge — the cards have 13px of padding, so
 * a row flush to the column reads as wider than everything above it.
 */
/**
 * The card carries no colour of its own. Category lives on the ring around the
 * sender's face, which is one small circle per row instead of a bar down every
 * card in the stack.
 */
const CARD = cn(
  "relative mb-[7px] flex min-h-[58px] w-full items-center gap-3.5 rounded-2xl bg-bg-white-0 p-[13px]",
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
        // Neutral on purpose: the accent belongs to the flags, which say what
        // is wanted. This only says when, and competed with them for it.
        "shrink-0 whitespace-nowrap text-label-xs font-medium",
        deadline.late ? "text-text-soft-400" : "text-text-sub-600",
      )}
    >
      {deadline.label}
    </span>
  );
}

/** When it arrived. The weakest fact on the card, and styled like it. */
function Time({ at }: { at: string }) {
  return (
    <time
      dateTime={at}
      className="shrink-0 text-label-xs font-medium text-text-soft-400"
    >
      {new Date(at).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })}
    </time>
  );
}

/**
 * What this card wants from you, if anything. A 6px dot said only "something",
 * which is no use for scanning: this names the thing, in the accent already
 * used for anything that wants a reader.
 */
function ActionFlag({ item }: { item: DigestItem }) {
  // A reply arrow is the shape every mail client uses for the action; a warning
  // circle reads as "attend to this" where a flag reads as "flag it for later".
  const kind = item.needsReply
    ? {
        icon: RiReplyLine,
        hint: "Someone is waiting on your reply",
        tone: "bg-primary-alpha-10 text-primary-dark",
      }
    : // "high" is the model's word for needs-you-today-or-tomorrow.
      item.urgency === "high"
      ? {
          icon: RiErrorWarningLine,
          hint: "Needs you today or tomorrow",
          tone: "bg-orange-alpha-10 text-orange-700",
        }
      : null;
  if (!kind) return null;

  const Icon = kind.icon;

  return (
    <span
      title={kind.hint}
      aria-label={kind.hint}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
        kind.tone,
      )}
    >
      <Icon aria-hidden className="size-3" />
    </span>
  );
}

/**
 * What the card actually says. The sender leads, because in a list of forty the
 * question is "who" before "what"; under it goes Claude's one-line read, since
 * a subject is what a sender called their mail and a blurb is what it says.
 */
function CardBody({
  sender,
  blurb,
  at,
  trailing,
  compact = false,
  read = false,
  children,
}: {
  sender: string;
  blurb: string;
  at?: string;
  /** Sits on the top line, right of the time: a deadline or a thread count. */
  trailing?: React.ReactNode;
  /** One line at every width, for lanes read by scanning rather than reading. */
  compact?: boolean;
  /** Already read: the sender steps back so unread mail carries the weight. */
  read?: boolean;
  /** Overrides the blurb line entirely — used by invitations. */
  children?: React.ReactNode;
}) {
  return (
    <span className="min-w-0 flex-1 overflow-hidden">
      <span className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "truncate text-label-sm md:text-label-md",
            read
              ? "font-medium text-text-sub-600"
              : "font-semibold text-text-strong-950",
          )}
        >
          {sender}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {trailing}
          {at && <Time at={at} />}
        </span>
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

/** The ordinary card: who it is from, what it says, and by when. */
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
    <Link
      href={`/message/${item.id}?date=${day}`}
      className={cn(CARD, "outline-none")}
    >
      <SenderAvatar
        name={item.from}
        email={item.fromEmail}
        category={item.category}
      />
      <CardBody
        sender={item.from}
        blurb={item.blurb || item.purpose}
        at={showTime ? item.receivedAt : undefined}
        compact={compact}
        read={!item.unread}
        trailing={
          <>
            <ActionFlag item={item} />
            <Deadline item={item} day={day} />
          </>
        }
      />
    </Link>
  );
}

/**
 * A conversation, as one card: eighteen replies to the same pull request are
 * one thing that happened. Gmail already groups them, so the card names who is
 * in it and how many, and opens on the newest.
 */
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
    <Link
      href={`/message/${latest.id}?date=${day}`}
      className={cn(CARD, "outline-none")}
    >
      <SenderAvatar
        name={latest.from}
        email={latest.fromEmail}
        category={latest.category}
      />
      <CardBody
        sender={participantLabel(thread.participants)}
        blurb={latest.blurb || thread.subject}
        at={showTime ? latest.receivedAt : undefined}
        compact={compact}
        read={!latest.unread}
        trailing={
          <>
            <ActionFlag item={latest} />
            <span className="rounded-full bg-bg-weak-50 px-1.5 py-0.5 text-label-xs font-semibold tabular-nums text-text-sub-600">
              {thread.count}
            </span>
          </>
        }
      />
    </Link>
  );
}

/**
 * An invitation — the one message whose four essentials are never in the
 * subject line — so it gets a date block instead of an avatar and a reply row
 * instead of a deadline. Accept and Decline open Gmail, because RSVP is a write
 * and this app holds a read-only scope.
 */
function InviteCard({ item, day }: { item: DigestItem; day: string }) {
  const invite = item.invite!;
  const block = eventDateBlock(invite.start, invite.allDay);
  const unanswered = invite.status === "needs-action" && !invite.cancelled;
  const gmail = gmailThreadUrl(item.threadId || item.id, "");

  return (
    <div className={cn(CARD, "flex-col items-stretch gap-0 py-0 md:py-0")}>
      <div className="flex items-center gap-3.5 py-[13px] md:gap-4 md:py-4">
        {/* The date block is already the Meetings colour, so it needs no ring
            around it the way a sender's face does. */}
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
            {/* Stretched so the whole card opens the message, without nesting
                a link inside a link the way a wrapping <a> would. */}
            <Link
              href={`/message/${item.id}?date=${day}`}
              className="truncate text-label-sm font-semibold text-text-strong-950 outline-none after:absolute after:inset-0 focus-visible:underline md:text-label-md"
            >
              {invite.cancelled && "Cancelled: "}
              {invite.summary || item.purpose}
            </Link>
            {!unanswered && !invite.cancelled && invite.status !== "unknown" && (
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

/** Whichever card this message deserves. */
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
  // An invitation shows its event's time, which matters whatever day you are
  // reading — that is not the same fact as when the mail arrived.
  if (thread.latest.invite) return <InviteCard item={thread.latest} day={day} />;
  return (
    <MessageCard
      item={thread.latest}
      day={day}
      showTime={showTime}
      compact={compact}
    />
  );
}

/**
 * A stack of cards, threaded.
 *
 * Threading groups by conversation, which reorders nothing on its own — the
 * threads come out in the order their newest message did, so whichever sort
 * the caller applied upstream still holds.
 */
export function CardList({
  items,
  day,
  showTime = false,
  compact = false,
}: {
  items: DigestItem[];
  day: string;
  /** Only today's digest carries arrival times. See {@link DayView}. */
  showTime?: boolean;
  /** One-line blurbs, for Social. */
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

/**
 * Social, as cards like everything else — no heading, because no other lane
 * gets one and a rule across the list only asked what it was for. The ring on
 * each sender's face already says which lane this is, and the blurbs are held
 * to one line because these are scanned rather than read.
 */
export function SocialCards({
  items,
  day,
}: {
  items: DigestItem[];
  day: string;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <CardList items={items} day={day} compact />
    </section>
  );
}
