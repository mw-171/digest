import { RiArrowLeftSLine, RiExternalLinkLine } from "@remixicon/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import * as React from "react";

import { SenderAvatar } from "@/app/component/digest/avatar-initials";
import { EmailBody } from "@/app/component/digest/email-body";
import * as Button from "@/app/component/ui/button";
import { readCachedInsight } from "@/lib/digest-ai";
import { isValidDay, toDayString } from "@/lib/day";
import { isConversational, plainText, type ReadableBody } from "@/lib/email-body";
import { fetchAccountEmail, fetchMessage, gmailThreadUrl } from "@/lib/gmail";
import { authorizedClient } from "@/lib/google";
import { summarizeMessage } from "@/lib/message-ai";
import type { FullMessage } from "@/lib/gmail";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-label-xs font-semibold uppercase tracking-[0.05em] text-text-soft-400">
      {children}
    </p>
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

  const auth = await authorizedClient();
  // Not connected: the digest is where reconnecting starts.
  if (!auth) redirect("/");

  const [message, insight, account] = await Promise.all([
    fetchMessage(auth, id),
    readCachedInsight(day, id),
    fetchAccountEmail(auth).catch(() => ""),
  ]);

  const band = insight?.band ?? "notifications";
  const received = new Date(message.receivedAt);

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
          <span className="text-label-xs uppercase tracking-[0.08em] text-text-soft-400">
            Read only
          </span>
        </header>

        <div className="pb-16 pt-3">
          <h1 className="break-words text-title-h5 tracking-[-0.03em] text-text-strong-950 text-pretty md:text-title-h4">
            {insight?.purpose ?? message.subject}
          </h1>

          <div className="mt-4 flex items-center gap-3 border-b border-stroke-soft-200 pb-4">
            <SenderAvatar
              name={message.from}
              email={message.fromEmail}
              band={band}
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

          <React.Suspense fallback={<ReadingSkeleton />}>
            <Reading message={message} body={message.body} />
          </React.Suspense>

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
