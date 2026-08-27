"use client";

import * as React from "react";

import { cn } from "@/utils/cn";

/**
 * What the wait is spent on, roughly in the order it happens: the mailbox is
 * read, the messages are summarised, and the summaries are sorted into lanes.
 */
const LABELS = ["Digesting…", "Summarizing…", "Sorting…"];

/** Long enough that the word is read rather than watched. */
const HOLD_MS = 5000;

/** Matches the fade either side of the swap, so the word is never half-there. */
const CROSSFADE_MS = 300;

/**
 * What the app is doing while you wait: an ordinary ring spinner, because a
 * wait is a wait and this is the shape everybody already reads as one, under a
 * word that turns over as the work does.
 *
 * The spinner laps rather than advances — triage reports no progress we could
 * honestly divide into quarters — but the words are in the order the pipeline
 * actually runs, so a long wait says something truthful about where it is.
 */
export function Digesting({ className }: { className?: string }) {
  const [step, setStep] = React.useState(0);
  const [shown, setShown] = React.useState(true);

  React.useEffect(() => {
    // Fade the word out, swap it while nothing is legible, fade the next in.
    // Two timers rather than one so the swap lands at the bottom of the fade.
    const hold = setTimeout(() => setShown(false), HOLD_MS);
    const swap = setTimeout(() => {
      setStep((current) => (current + 1) % LABELS.length);
      setShown(true);
    }, HOLD_MS + CROSSFADE_MS);

    return () => {
      clearTimeout(hold);
      clearTimeout(swap);
    };
  }, [step]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center gap-3", className)}
    >
      <span
        aria-hidden
        className="size-6 animate-spin rounded-full border-2 border-bg-soft-200 border-t-text-strong-950 motion-reduce:animate-none"
      />
      {/* One announcement for the whole wait. The rotating word is decoration
          on top of it — read aloud, it would interrupt every six seconds. */}
      <span className="sr-only">Loading your digest</span>
      <span
        aria-hidden
        style={{ transitionDuration: `${CROSSFADE_MS}ms` }}
        className={cn(
          "text-label-sm font-medium text-text-sub-600",
          "transition-opacity ease-out motion-reduce:transition-none",
          shown ? "opacity-100" : "opacity-0",
        )}
      >
        {LABELS[step]}
      </span>
    </div>
  );
}

/**
 * The indicator, fixed to the viewport so it centres on the screen rather than
 * on the content box — which starts below a header tall enough to push it past
 * the middle on a phone. No z-index: as a later sibling it paints over the
 * scrim, and the header's `z-10` keeps it above both.
 */
export function DigestingOverlay({ visible = true }: { visible?: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 flex items-center justify-center",
        // Fades out on its own clock rather than vanishing the moment the mail
        // lands, so it leaves alongside the blur instead of ahead of it.
        "transition-opacity duration-500 ease-out",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      {/* Fades in with the scrim behind it rather than landing on a page that
          is still settling. */}
      <Digesting className="animate-in fade-in-0 duration-300" />
    </div>
  );
}

/**
 * A wash of the page's own colour over content on its way out, which also
 * catches anything aimed at it. Softer than the blur it replaces, which had to
 * resolve a whole layer of pixels and made a day-switch feel heavier than the
 * switch itself.
 */
export function Scrim({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        // Not pass-through: it swallows taps on the content underneath, which
        // is either the wrong day or about to be replaced by the right one.
        // `touch-action: none` stops a drag started here from scrolling.
        "absolute inset-0 touch-none bg-bg-white-0",
        "transition-opacity duration-500 ease-out",
        // Nothing to swallow once it has faded out.
        visible ? "opacity-60" : "pointer-events-none opacity-0",
      )}
    />
  );
}
