"use client";

import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiChat3Line,
  RiMailLine,
  RiPriceTag3Line,
  RiUserSmileLine,
} from "@remixicon/react";
import Link from "next/link";
import * as React from "react";

import { SenderAvatar } from "./avatar-initials";
import { CATEGORY_STYLE } from "./categories";
import * as Accordion from "@/app/component/ui/accordion";
import { eventDateBlock, formatDeadline, formatEventTime } from "@/lib/day";
import {
  describeGroups,
  groupBySender,
  participantLabel,
  threadsOf,
  type GroupKind,
  type SenderGroup,
  type Thread,
} from "@/lib/grouping";
import { cn } from "@/utils/cn";
import type { DigestItem } from "@/lib/digest";
import { gmailThreadUrl } from "@/lib/gmail-url";

/**
 * Rows inside a collapsed group line up with the text inside a message card
 * rather than with the column's own edge — the cards have 13px of padding, so
 * a row flush to the column reads as wider than everything above it.
 */
const ROW = "px-[13px] py-2 md:px-5";

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
        "shrink-0 whitespace-nowrap text-label-xs font-semibold",
        deadline.late ? "text-text-soft-400" : "text-primary-base",
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

/** The dot that means someone is waiting. */
function ReplyDot() {
  return (
    <span
      aria-label="Needs a reply"
      className="size-[6px] shrink-0 self-center rounded-full bg-primary-base"
    />
  );
}

/**
 * What the card actually says.
 *
 * The sender's name leads, because in a list of forty the question is always
 * "who" before "what". Under it, Claude's one-line read of the message —
 * which is the change this layout is really for: a subject line is what a
 * sender chose to call their mail, and a blurb is what the mail says.
 */
function CardBody({
  sender,
  blurb,
  at,
  trailing,
  children,
}: {
  sender: string;
  blurb: string;
  at?: string;
  /** Sits on the top line, right of the time: a deadline or a thread count. */
  trailing?: React.ReactNode;
  /** Overrides the blurb line entirely — used by invitations. */
  children?: React.ReactNode;
}) {
  return (
    <span className="min-w-0 flex-1 overflow-hidden">
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-label-sm font-semibold text-text-strong-950 md:text-label-md">
          {sender}
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          {trailing}
          {at && <Time at={at} />}
        </span>
      </span>

      {children ?? (
        <span className="mt-0.5 line-clamp-2 block text-label-xs leading-snug text-text-sub-600 [overflow-wrap:anywhere] md:mt-1 md:line-clamp-1 md:text-label-sm">
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
}: {
  item: DigestItem;
  day: string;
  showTime: boolean;
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
        trailing={<Deadline item={item} day={day} />}
      />
      {item.needsReply && <ReplyDot />}
    </Link>
  );
}

/**
 * A conversation, as one card.
 *
 * Eighteen replies to the same pull request are one thing that happened, not
 * eighteen. Gmail already tells us which messages belong together, so the card
 * says who is in it and how many there are, and opening it lands on the newest
 * message.
 */
function ThreadCard({
  thread,
  day,
  showTime,
}: {
  thread: Thread;
  day: string;
  showTime: boolean;
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
        trailing={
          <span className="rounded-full bg-bg-weak-50 px-1.5 py-0.5 text-label-xs font-semibold text-text-sub-600">
            {thread.count}
          </span>
        }
      />
      {latest.needsReply && <ReplyDot />}
    </Link>
  );
}

/**
 * An invitation, which is the one message where the four things you need are
 * never in the subject line: the date, the time, the place, and whether you
 * have answered. So it gets a date block instead of an avatar and a reply row
 * instead of a deadline.
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
          <span className="flex items-baseline justify-between gap-2">
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
}: {
  thread: Thread;
  day: string;
  showTime: boolean;
}) {
  if (thread.count > 1)
    return <ThreadCard thread={thread} day={day} showTime={showTime} />;
  // An invitation shows its event's time, which matters whatever day you are
  // reading — that is not the same fact as when the mail arrived.
  if (thread.latest.invite) return <InviteCard item={thread.latest} day={day} />;
  return <MessageCard item={thread.latest} day={day} showTime={showTime} />;
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
}: {
  items: DigestItem[];
  day: string;
  /** Only today's digest carries arrival times. See {@link DayView}. */
  showTime?: boolean;
}) {
  return (
    <>
      {threadsOf(items).map((thread) => (
        <ThreadEntry
          key={thread.id}
          thread={thread}
          day={day}
          showTime={showTime}
        />
      ))}
    </>
  );
}

/**
 * Social, in three rows instead of forty.
 *
 * These messages were never read — Gmail's labels put them here and only their
 * headers were fetched — so the useful question is not what each one says but
 * what the pile is made of. Threading collapses the bot chatter, grouping by
 * sender turns what is left into a handful of tappable lines, and the sentence
 * above them is arithmetic on those groups rather than a model's guess.
 */
export function SocialGroups({
  items,
  day,
  heading = true,
}: {
  items: DigestItem[];
  day: string;
  /** Off when the Social tile is the filter and the rule above already said so. */
  heading?: boolean;
}) {
  if (items.length === 0) return null;

  const groups = groupBySender(threadsOf(items));

  return (
    <section>
      {heading && (
        <div className="flex items-center gap-2.5 pb-1 pt-6">
          <span
            className={cn(
              "size-[9px] shrink-0 rounded-[3px]",
              CATEGORY_STYLE.social.swatch,
            )}
          />
          <span className="text-label-xs font-semibold uppercase tracking-[0.05em] text-text-soft-400">
            Social
          </span>
          <span className="text-label-xs text-text-soft-400">{items.length}</span>
          <span className="h-px flex-1 bg-stroke-soft-200" />
        </div>
      )}
      <p className="pb-1 text-label-xs text-text-soft-400">
        {describeGroups(groups)}
      </p>
      {groups.map((group) => (
        <SenderRow key={group.key || "rest"} group={group} day={day} />
      ))}
    </section>
  );
}

/** What stands in for a face when the group is a category, not a sender. */
const BUCKET_ICON: Record<Exclude<GroupKind, "sender">, React.ElementType> = {
  promotions: RiPriceTag3Line,
  social: RiUserSmileLine,
  forums: RiChat3Line,
  mixed: RiMailLine,
};

function GroupIcon({ group }: { group: SenderGroup }) {
  if (group.kind === "sender") {
    // No ring down here: every row in this section is Social, so a ring on
    // each one would spend colour saying what the heading already said.
    return (
      <SenderAvatar
        name={group.label}
        email={group.threads[0].latest.fromEmail}
        category="social"
        size="32"
        ring={false}
      />
    );
  }

  // The remainder is not a sender, so it gets a symbol rather than a face:
  // borrowing a member's logo would name the row after whichever newsletter
  // happened to sort first.
  const Icon = BUCKET_ICON[group.kind];
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-weak-50">
      <Icon className="size-4 text-text-soft-400" />
    </span>
  );
}

/** Quieter than a title, and never the loudest thing in its row. */
function Count({ value }: { value: number }) {
  return (
    <span className="shrink-0 text-label-xs tabular-nums text-text-soft-400">
      {value}
    </span>
  );
}

/** How many conversations a source shows before it needs asking twice. */
const VISIBLE_THREADS = 5;

/**
 * One source, and what it sent.
 *
 * The header names the sender — never one of its subject lines, which is what
 * made this read as a random email promoted above its siblings — and follows
 * it with two or three words on what the pile is about. Underneath, one row
 * per conversation with the boilerplate they all share stripped off the front,
 * so what is left is the part that differs.
 */
function SenderRow({ group, day }: { group: SenderGroup; day: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const shown = expanded ? group.threads : group.threads.slice(0, VISIBLE_THREADS);
  const hidden = group.threads.length - shown.length;

  return (
    <Accordion.Root type="single" collapsible>
      <Accordion.Item
        value={group.key || "rest"}
        className={cn(
          "rounded-none bg-transparent p-0 ring-0",
          "hover:bg-transparent has-[:focus-visible]:bg-transparent",
          "data-[state=open]:bg-transparent",
        )}
      >
        <Accordion.Header>
          <Accordion.Trigger className={cn(ROW, "m-0 flex w-full items-center gap-3")}>
            <GroupIcon group={group} />

            <span className="shrink-0 truncate text-left text-label-sm font-semibold text-text-strong-950">
              {group.label}
            </span>
            <span className="min-w-0 flex-1 truncate text-left text-label-xs text-text-soft-400">
              {group.descriptor}
            </span>

            <Count value={group.count} />
            <Accordion.Arrow
              openIcon={RiArrowDownSLine}
              closeIcon={RiArrowUpSLine}
              className="size-4 shrink-0"
            />
          </Accordion.Trigger>
        </Accordion.Header>

        <Accordion.Content className="pt-0 text-inherit">
          {/* No avatars down here: the header carries the face, the indent
              carries the relationship. */}
          {/* Indented to where the source label starts: 13px of row padding,
              a 32px mark and the gap after it. */}
          <div className="pb-1.5 pl-[57px] md:pl-16">
            {shown.map((thread) => (
              <Link
                key={thread.id}
                href={`/message/${thread.latest.id}?date=${day}`}
                className={cn(
                  ROW,
                  "flex items-baseline gap-3 py-1.5 pl-0 outline-none focus-visible:underline",
                )}
              >
                <span className="min-w-0 flex-1 truncate text-label-xs text-text-sub-600">
                  {thread.title}
                </span>
                {thread.count > 1 && <Count value={thread.count} />}
              </Link>
            ))}

            {hidden > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className={cn(
                  ROW,
                  "flex w-full py-1.5 pl-0 text-left text-label-xs text-text-soft-400 outline-none hover:text-text-sub-600",
                )}
              >
                + {hidden} more {hidden === 1 ? "thread" : "threads"}
              </button>
            )}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}
