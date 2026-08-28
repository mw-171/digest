"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RiAiGenerateText, RiRefreshLine } from "@remixicon/react";
import Link from "next/link";
import * as React from "react";

import { CopyDraft } from "./copy-draft";
import { useHydrated } from "@/app/component/digest/loading-state";
import * as Button from "@/app/component/ui/button";
import { cn } from "@/utils/cn";
import { draftQuery, regenerateDraft, voiceQuery } from "@/lib/digest-query";

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

/** How long to keep following the page before leaving the reader alone. */
const FOLLOW_MS = 8000;

/**
 * Brings the panel into view once `active`, and keeps it there while the page
 * above is still growing. The summary arrives from its own boundary seconds
 * after a cached draft renders and pushes this down the page, so one scroll on
 * arrival would land somewhere else by the time you looked. Anything the
 * reader does themselves ends it immediately.
 */
function useScrollTo<T extends HTMLElement>(active: boolean) {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    if (!active || !ref.current) return;

    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    let following = true;

    const follow = () => {
      if (!following || !ref.current) return;
      ref.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "start",
      });
    };

    const observer = new ResizeObserver(follow);
    const events = ["wheel", "touchstart", "keydown"] as const;
    const stop = () => {
      following = false;
      observer.disconnect();
      for (const event of events) window.removeEventListener(event, stop);
    };

    follow();
    observer.observe(document.body);
    for (const event of events) {
      window.addEventListener(event, stop, { passive: true });
    }
    const timer = setTimeout(stop, FOLLOW_MS);

    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [active]);

  return ref;
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
function Draft({ id }: { id: string }) {
  const voice = useQuery(voiceQuery());
  const options = draftQuery(id, voice.data);
  const draft = useQuery(options);
  const queryClient = useQueryClient();

  // A mutation rather than a refetch: the query is the draft you have, and
  // this is the deliberate act of replacing it. Writing the answer straight
  // into the query's entry keeps the new one for good.
  const again = useMutation({
    mutationFn: () => regenerateDraft(id, voice.data!),
    onSuccess: (next) => queryClient.setQueryData(options.queryKey, next),
  });

  if (voice.isError || draft.isError) return <NoDraft reason="failed" />;
  if (voice.data && voice.data.profile.summary.length === 0) {
    return <NoDraft reason="unread" />;
  }
  if (!draft.data) return <DraftSkeleton />;
  if (draft.data.source === "none") return <NoDraft reason="failed" />;

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <Label>Draft reply</Label>

        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-label-xs text-text-soft-400">
            <RiAiGenerateText aria-hidden className="size-3.5" />
            In your voice
          </span>
          <Button.Root
            variant="neutral"
            mode="stroke"
            size="xsmall"
            // Square and wordless, with the `::after` carrying the 44px a
            // thumb needs without a 44px box in the header.
            className="w-8 shrink-0 justify-center px-0 after:absolute after:-inset-1.5"
            aria-label="Write a new draft"
            title="Write a new draft"
            disabled={again.isPending}
            onClick={() => again.mutate()}
          >
            <Button.Icon
              as={RiRefreshLine}
              // Smaller than the button slot's default, so the glyph sits in
              // the square rather than filling it.
              className={cn(
                "size-4",
                again.isPending && "animate-spin motion-reduce:animate-none",
              )}
            />
          </Button.Root>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words text-paragraph-md leading-relaxed text-text-strong-950">
        {withPlaceholders(draft.data.body)}
      </p>

      {draft.data.notes.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-stroke-soft-200 pt-4">
          {draft.data.notes.map((note) => (
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
        <CopyDraft text={draft.data.body} />
        <p className="min-w-0 flex-1 text-label-xs text-text-soft-400">
          {again.isError
            ? "That one did not come back. Try the refresh button again."
            : "Not saved to Gmail, since digest can only read your mail. Copy into a reply!"}
        </p>
      </div>

      {/* The button has no label to change, so the wait is announced instead. */}
      <span aria-live="polite" className="sr-only">
        {again.isPending ? "Writing a new draft in your voice" : ""}
      </span>
    </section>
  );
}

export function DraftPanel({ id }: { id: string }) {
  // The persisted cache can restore before React reaches this subtree, and a
  // draft rendered on the first pass would disagree with the server's HTML.
  const hydrated = useHydrated();
  const ref = useScrollTo<HTMLDivElement>(hydrated);

  return (
    <div ref={ref} className="scroll-mt-4">
      {hydrated ? <Draft id={id} /> : <DraftSkeleton />}
    </div>
  );
}

