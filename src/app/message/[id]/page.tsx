import type { Metadata } from "next";
import {
  RiAiGenerateText,
  RiArrowLeftSLine,
  RiExternalLinkLine,
} from "@remixicon/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import * as React from "react";

import { SenderAvatar } from "@/app/component/digest/avatar-initials";
import { CATEGORY_STYLE } from "@/app/component/digest/categories";
import { EmailBody } from "@/app/component/digest/email-body";
import { CopyDraft } from "@/app/component/drafts/copy-draft";
import * as Button from "@/app/component/ui/button";
import { readCachedInsight } from "@/lib/digest-ai";
import { isValidDay, toDayString } from "@/lib/day";
import {
  isConversational,
  plainText,
  type ReadableBody,
} from "@/lib/email-body";
import { formatEventTime } from "@/lib/day";
import { fetchAccountEmail, fetchMessage } from "@/lib/gmail";
import { gmailThreadUrl } from "@/lib/gmail-url";
import { authorizedClient } from "@/lib/google";
import { draftReply } from "@/lib/draft-ai";
import { summarizeMessage } from "@/lib/message-ai";
import { voiceForDrafting } from "@/lib/voice";
import { CATEGORY_TITLES } from "@/lib/digest";
import type { Category } from "@/lib/digest-ai";
import type { FullMessage } from "@/lib/gmail";

/** The subject in the tab, so a pinned message is identifiable. */
export async function generateMetadata({
  params,
}: PageProps<"/message/[id]">): Promise<Metadata> {
  const auth = await authorizedClient();
  if (!auth) return { title: "Message" };

  try {
    const message = await fetchMessage(auth, (await params).id);
    return { title: message.subject || "Message" };
  } catch {
    return { title: "Message" };
  }
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-label-xs font-semibold uppercase tracking-[0.05em] text-text-soft-400">
      {children}
    </p>
  );
}

/**
 * Which of the four tiles this message came from. It is the one piece of
 * context the digest had and this page did not — without it, arriving here
 * from a tap on Meetings tells you nothing about why the message was there.
 */
function CategoryChip({ category }: { category: Category }) {
  const style = CATEGORY_STYLE[category];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${style.chip}`}
    >
      <span className={`size-2 rounded-[2px] ${style.swatch}`} />
      <span className={`text-label-xs font-semibold ${style.ink}`}>
        {CATEGORY_TITLES[category]}
      </span>
    </span>
  );
}

/**
 * Claude's read of the email, and — when the message is something a person
 * typed rather than something a marketing team laid out — the message itself
 * underneath. Awaiting the summary is what this component is for: the page
 * around it streams first and this arrives when Claude answers.
 */
async function Reading({
  message,
  body,
}: {
  message: FullMessage;
  body: ReadableBody;
}) {
  const summary = await summarizeMessage(message, plainText(body.blocks));
  const conversational = isConversational(body);
  // With no summary to show, the extracted text is all we have — better a
  // flattened newsletter than a blank page.
  const showBody = conversational || summary.source === "none";

  return (
    <>
      {summary.source === "claude" && (
        <section className="mt-6 rounded-2xl bg-bg-weak-50 p-5 md:p-6">
          <Label>Summary</Label>
          <p className="mt-2.5 break-words text-paragraph-md leading-relaxed text-text-strong-950 text-pretty">
            {summary.summary}
          </p>

          {summary.points.length > 0 && (
            <ul className="mt-3.5 flex flex-col gap-1.5">
              {summary.points.map((point, index) => (
                <li
                  key={index}
                  className="flex gap-2.5 text-paragraph-sm text-text-sub-600"
                >
                  <span
                    aria-hidden
                    className="mt-[7px] size-[5px] shrink-0 rounded-full bg-bg-soft-200"
                  />
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {summary.action && (
            <p className="mt-4 flex items-baseline gap-2.5 border-t border-stroke-soft-200 pt-4">
              <span className="size-[9px] shrink-0 translate-y-px rounded-[3px] bg-primary-base" />
              <span className="text-label-sm font-semibold text-text-strong-950">
                {summary.action}
              </span>
            </p>
          )}
        </section>
      )}

      {showBody && (
        <section className="mt-7">
          {summary.source === "claude" && <Label>The message</Label>}
          <EmailBody body={body} fallback={message.snippet} />
        </section>
      )}
    </>
  );
}

/**
 * A gap the model refused to invent its way past. Marked rather than left in
 * the sentence, so the one thing you have to fill in is the one thing you see.
 */
const PLACEHOLDER = /\[[^\]\n]{1,40}\]/g;

function withPlaceholders(text: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(PLACEHOLDER)) {
    const at = match.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(
      <mark
        key={at}
        className="rounded bg-yellow-alpha-10 px-1 font-medium text-yellow-900"
      >
        {match[0]}
      </mark>,
    );
    last = at + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Nothing to write in: the voice has never been read, or Claude is unreachable. */
function NoDraft({ unread }: { unread: boolean }) {
  return (
    <section className="mt-7 rounded-2xl border border-stroke-soft-200 p-5 md:p-6">
      <Label>Draft reply</Label>
      <p className="mt-2.5 text-paragraph-sm text-text-sub-600">
        {unread
          ? "A draft is written in your voice, and your voice has not been read yet. Open Drafts once and it will be ready here."
          : "The draft could not be written this time. Reload the page to try again."}
      </p>
      {unread && (
        <Button.Root
          asChild
          variant="neutral"
          mode="stroke"
          size="xsmall"
          className="mt-4"
        >
          <Link href="/drafts">Read my voice</Link>
        </Button.Root>
      )}
    </section>
  );
}

/**
 * A reply, written the way you write. Gmail is connected read-only, so this is
 * text to copy rather than a draft in your mailbox — which the section says
 * plainly rather than letting the button imply otherwise.
 */
async function Draft({
  message,
  body,
  account,
}: {
  message: FullMessage;
  body: ReadableBody;
  account: string;
}) {
  const voice = await voiceForDrafting(account);
  const draft = await draftReply(message, plainText(body.blocks), voice);

  if (draft.source === "none") return <NoDraft unread={!voice.profile.summary} />;

  return (
    <section className="mt-7 rounded-2xl border border-stroke-soft-200 p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <Label>Draft reply</Label>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-label-xs text-text-soft-400">
          <RiAiGenerateText aria-hidden className="size-3.5" />
          In your voice
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words text-paragraph-md leading-relaxed text-text-strong-950">
        {withPlaceholders(draft.body)}
      </p>

      {draft.notes.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-stroke-soft-200 pt-4">
          {draft.notes.map((note) => (
            <li
              key={note}
              className="flex gap-2.5 text-label-xs text-text-sub-600"
            >
              <span
                aria-hidden
                className="mt-[6px] size-[5px] shrink-0 rounded-[2px] bg-yellow-600"
              />
              <span className="min-w-0 break-words">{note}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-stroke-soft-200 pt-4">
        <CopyDraft text={draft.body} />
        <p className="text-label-xs text-text-soft-400">
          Not saved to Gmail yet — digest only reads your mail. Copy it into a
          reply.
        </p>
      </div>
    </section>
  );
}

function DraftSkeleton() {
  return (
    <div
      className="mt-7 rounded-2xl border border-stroke-soft-200 p-5 md:p-6"
      aria-hidden
    >
      <div className="h-2.5 w-20 rounded-full bg-bg-weak-50" />
      <div className="mt-4 flex flex-col gap-2.5">
        <div className="h-3 w-[64%] rounded-full bg-bg-weak-50" />
        <div className="h-3 w-full rounded-full bg-bg-weak-50" />
        <div className="h-3 w-[88%] rounded-full bg-bg-weak-50" />
        <div className="mt-2 h-3 w-[30%] rounded-full bg-bg-weak-50" />
      </div>
    </div>
  );
}

function ReadingSkeleton() {
  return (
    <div className="mt-6 rounded-2xl bg-bg-weak-50 p-5 md:p-6" aria-hidden>
      <div className="h-2.5 w-16 rounded-full bg-bg-soft-200" />
      <div className="mt-4 flex flex-col gap-2.5">
        <div className="h-3 w-full rounded-full bg-bg-soft-200" />
        <div className="h-3 w-[92%] rounded-full bg-bg-soft-200" />
        <div className="h-3 w-2/3 rounded-full bg-bg-soft-200" />
      </div>
    </div>
  );
}

export default async function MessagePage({
  params,
  searchParams,
}: PageProps<"/message/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const requested = typeof query.date === "string" ? query.date : toDayString();
  const day = isValidDay(requested) ? requested : toDayString();
  // In the URL rather than in state: a draft is worth sharing, reloading and
  // going back from, and it is what the card's button asks for.
  const wantsDraft = query.draft === "1";

  const auth = await authorizedClient();
  // Not connected: the digest is where reconnecting starts.
  if (!auth) redirect("/");

  // The address first: an invite's ATTENDEE lines are matched against it to
  // find out whether you have replied.
  const account = await fetchAccountEmail(auth).catch(() => "");
  const [message, insight] = await Promise.all([
    fetchMessage(auth, id, account),
    readCachedInsight(day, id),
  ]);

  // An invitation is about a scheduled thing whatever the day's triage said,
  // and this page can see the parsed invite even when the day was never opened.
  const category: Category = message.invite
    ? "meetings"
    : (insight?.category ?? "updates");
  const received = new Date(message.receivedAt);
  // An invitation wants an RSVP rather than a written reply, and Gmail's own
  // buttons already do that better than a paragraph would.
  const needsReply = Boolean(insight?.needsReply) && !message.invite;

  return (
    <div className="flex min-h-dvh flex-col bg-bg-white-0">
      <div className="mx-auto w-full min-w-0 max-w-[440px] px-6 md:max-w-2xl md:px-10">
        <header className="flex items-center justify-between pb-3 pt-5 md:pt-8">
          <Link
            href={`/?date=${day}`}
            className="flex items-center gap-1 text-label-sm text-text-sub-600 hover:text-text-strong-950"
          >
            <RiArrowLeftSLine className="size-4" />
            Digest
          </Link>
        </header>

        <div className="pb-16 pt-3">
          <CategoryChip category={category} />

          <h1 className="mt-3 break-words text-title-h5 tracking-[-0.03em] text-text-strong-950 text-pretty md:text-title-h4">
            {insight?.purpose ?? message.subject}
          </h1>

          <div className="mt-4 flex items-center gap-3 border-b border-stroke-soft-200 pb-4">
            <SenderAvatar
              name={message.from}
              email={message.fromEmail}
              category={category}
              size="40"
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-label-sm font-semibold text-text-strong-950">
                {message.from}
              </p>
              <p className="truncate text-label-xs text-text-soft-400">
                {message.fromEmail}
              </p>
            </div>
            <time
              dateTime={message.receivedAt}
              className="shrink-0 text-label-xs text-text-soft-400"
            >
              {received.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>
          </div>

          {insight?.purpose && insight.purpose !== message.subject && (
            <p className="mt-4 break-words text-paragraph-sm text-text-sub-600">
              {message.subject}
            </p>
          )}

          {message.invite && (
            <section className="mt-6 rounded-2xl border border-stroke-soft-200 p-5">
              <Label>
                {message.invite.cancelled ? "Cancelled event" : "Invitation"}
              </Label>
              <p className="mt-2 break-words text-label-md text-text-strong-950">
                {message.invite.summary || message.subject}
              </p>
              <p className="mt-1 text-paragraph-sm text-text-sub-600">
                {formatEventTime(message.invite.start, message.invite.allDay)}
                {message.invite.location && ` · ${message.invite.location}`}
              </p>
              {message.invite.status === "needs-action" &&
                !message.invite.cancelled && (
                  <p className="mt-3 text-label-xs text-text-soft-400">
                    You haven&apos;t replied. RSVP from Gmail below.
                  </p>
                )}
            </section>
          )}

          <React.Suspense fallback={<ReadingSkeleton />}>
            <Reading message={message} body={message.body} />
          </React.Suspense>

          {wantsDraft ? (
            <React.Suspense fallback={<DraftSkeleton />}>
              <Draft message={message} body={message.body} account={account} />
            </React.Suspense>
          ) : (
            needsReply && (
              <Button.Root
                asChild
                variant="neutral"
                mode="stroke"
                size="medium"
                className="mt-7 w-full sm:w-auto sm:px-6"
              >
                <Link href={`/message/${id}?date=${day}&draft=1`}>
                  <Button.Icon as={RiAiGenerateText} />
                  Draft a reply
                </Link>
              </Button.Root>
            )
          )}

          <Button.Root
            asChild
            variant="primary"
            mode="filled"
            className="mt-8 w-full sm:w-auto sm:px-8"
          >
            <a
              href={gmailThreadUrl(message.threadId || message.id, account)}
              target="_blank"
              rel="noreferrer"
            >
              Open full email in Gmail
              <Button.Icon as={RiExternalLinkLine} />
            </a>
          </Button.Root>
        </div>
      </div>
    </div>
  );
}

