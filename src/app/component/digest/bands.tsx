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
import type { Band as Tier } from "@/lib/digest-ai";
import type { DigestItem } from "@/lib/digest";
import { gmailThreadUrl } from "@/lib/gmail-url";

/**
 * Rows in the noise section line up with the text inside a message card rather
 * than with the column's own edge — the cards have 13px of padding, so a row
 * flush to the column reads as wider than everything above it.
 */
const ROW = "px-[13px] py-2 md:px-5";

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
 * The three tiers, as colour. Needs You carries the full accent; FYI is the
 * same hue held back rather than a different one, because it is still mail
 * that was read and sorted; noise is grey because nothing read it.
 */
const TONE: Record<Tier, { dot: string; label: string }> = {
  needs: { dot: "bg-primary-base", label: "text-text-strong-950" },
  fyi: { dot: "bg-purple-200", label: "text-text-sub-600" },
  noise: { dot: "bg-bg-soft-200", label: "text-text-soft-400" },
};

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
  tier,
  summary,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  tier: Tier;
  /** A line that stays visible while the band is shut. */
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const tone = TONE[tier];

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
              <span className={cn("size-[9px] shrink-0 rounded-[3px]", tone.dot)} />
              <span
                className={cn(
                  "text-label-xs font-semibold uppercase tracking-[0.05em]",
                  tone.label,
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
          {summary && (
            <p className="pb-1 text-label-xs text-text-soft-400">{summary}</p>
          )}
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
  tier,
  defaultOpen = true,
}: {
  title: string;
  items: DigestItem[];
  day: string;
  tier: Tier;
  defaultOpen?: boolean;
}) {
  if (items.length === 0) return null;
  const threads = threadsOf(items);

  return (
    <Band title={title} count={items.length} tier={tier} defaultOpen={defaultOpen}>
      {threads.map((thread) =>
        thread.count > 1 ? (
          <ThreadCard key={thread.id} thread={thread} day={day} />
        ) : thread.latest.invite ? (
          <InviteCard key={thread.id} item={thread.latest} day={day} />
        ) : (
          <MessageCard key={thread.id} item={thread.latest} day={day} />
        ),
      )}
    </Band>
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
function ThreadCard({ thread, day }: { thread: Thread; day: string }) {
  return (
    <Link
      href={`/message/${thread.latest.id}?date=${day}`}
      className={cn(CARD, "outline-none")}
    >
      <SenderAvatar
        name={thread.latest.from}
        email={thread.latest.fromEmail}
        band={thread.latest.band}
      />
      <span className="min-w-0 flex-1 overflow-hidden md:flex md:items-baseline md:gap-6">
        <span className="block truncate text-label-sm font-semibold text-text-strong-950 md:flex-1 md:text-label-md">
          {thread.subject}
        </span>
        <span className="mt-0.5 flex items-baseline gap-[7px] md:mt-0 md:w-64 md:shrink-0 md:justify-end lg:w-80">
          <span className="truncate text-label-xs text-text-sub-600">
            {participantLabel(thread.participants)}
          </span>
          <span className="shrink-0 rounded-full bg-bg-weak-50 px-1.5 py-0.5 text-label-xs font-semibold text-text-sub-600">
            {thread.count}
          </span>
        </span>
      </span>
    </Link>
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
 * Noise, in three rows instead of forty.
 *
 * These messages were never read — Gmail's labels put them here and only their
 * headers were fetched — so the useful question is not what each one says but
 * what the pile is made of. Threading collapses the bot chatter, grouping by
 * sender turns what is left into a handful of tappable lines, and the sentence
 * above them is arithmetic on those groups rather than a model's guess.
 */
export function NoiseSection({
  items,
  day,
}: {
  items: DigestItem[];
  day: string;
}) {
  if (items.length === 0) return null;

  const groups = groupBySender(threadsOf(items));

  return (
    <Band
      title="NOISE"
      count={items.length}
      tier="noise"
      summary={describeGroups(groups)}
    >
      {groups.map((group) => (
        <SenderRow key={group.key || "rest"} group={group} day={day} />
      ))}
    </Band>
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
    return (
      <SenderAvatar
        name={group.label}
        email={group.threads[0].latest.fromEmail}
        band="noise"
        size="32"
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
 * so what is left is the part that differs. A row goes straight to the
 * message: Noise, source, thread, detail, and no deeper.
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
