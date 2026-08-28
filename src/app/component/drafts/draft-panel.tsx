"use client";

import { useQuery } from "@tanstack/react-query";
import { RiAiGenerateText } from "@remixicon/react";
import Link from "next/link";
import * as React from "react";

import { CopyDraft } from "./copy-draft";
import * as Button from "@/app/component/ui/button";
import { useHydrated } from "@/app/component/digest/loading-state";
import { draftQuery, voiceQuery } from "@/lib/digest-query";

const CARD = "mt-7 rounded-2xl border border-stroke-soft-200 p-5 md:p-6";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-label-xs font-semibold uppercase tracking-[0.05em] text-text-soft-400">
      {children}
    </p>
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

function DraftSkeleton() {
  return (
    <div className={CARD} aria-hidden>
      <div className="h-2.5 w-20 rounded-full bg-bg-weak-50" />
      <div className="mt-4 flex flex-col gap-2.5">
        <div className="h-3 w-[64%] rounded-full bg-bg-weak-50" />
        <div className="h-3 w-full rounded-full bg-bg-weak-50" />
        <div className="h-3 w-[88%] rounded-full bg-bg-weak-50" />
        <div className="mt-2 h-3 w-[30%] rounded-full bg-bg-weak-50" />
      </div>
      <span className="sr-only" role="status">
        Writing a draft in your voice
      </span>
    </div>
  );
}

/** Nothing to write in, or nothing came back. Both end in something to do. */
function NoDraft({ reason }: { reason: "unread" | "failed" }) {
  return (
    <section className={CARD}>
      <Label>Draft reply</Label>
      <p className="mt-2.5 text-paragraph-sm text-text-sub-600">
        {reason === "unread"
          ? "A draft is written in your voice, and your voice has not been read yet. Open Drafts once and it will be ready here."
          : "The draft could not be written this time. Reload the page to try again."}
      </p>
      {reason === "unread" && (
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
 * A reply, written the way you write. Both halves are client queries so both
 * are cached in the browser: the voice is fetched once ever, and a draft once
 * per message. Gmail is connected read-only, so this is text to copy rather
 * than a draft in your mailbox, which the section says plainly rather than
 * letting the button imply otherwise.
 */
export function DraftPanel({ id }: { id: string }) {
  const voice = useQuery(voiceQuery());
  const draft = useQuery(draftQuery(id, voice.data));

  // The persisted cache can restore before React reaches this subtree, and a
  // draft rendered on the first pass would disagree with the server's HTML.
  const hydrated = useHydrated();
  if (!hydrated) return <DraftSkeleton />;

  if (voice.isError || draft.isError) return <NoDraft reason="failed" />;
  if (voice.data && voice.data.profile.summary.length === 0) {
    return <NoDraft reason="unread" />;
  }
  if (!draft.data) return <DraftSkeleton />;
  if (draft.data.source === "none") return <NoDraft reason="failed" />;

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <Label>Draft reply</Label>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-label-xs text-text-soft-400">
          <RiAiGenerateText aria-hidden className="size-3.5" />
          In your voice
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words text-paragraph-md leading-relaxed text-text-strong-950">
        {withPlaceholders(draft.data.body)}
      </p>

      {draft.data.notes.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-stroke-soft-200 pt-4">
          {draft.data.notes.map((note) => (
            <li key={note} className="flex gap-2.5 text-label-xs text-text-sub-600">
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
        <CopyDraft text={draft.data.body} />
        <p className="text-label-xs text-text-soft-400">
          Not saved to Gmail yet, since digest only reads your mail. Copy it
          into a reply.
        </p>
      </div>
    </section>
  );
}
