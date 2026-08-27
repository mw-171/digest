import { CATEGORY_STYLE } from "./categories";
import type { Category } from "@/lib/digest-ai";
import { cn } from "@/utils/cn";

/**
 * What the app is doing while you wait: an ordinary ring spinner, because a
 * wait is a wait and this is the shape everybody already reads as one.
 *
 * It laps rather than advances — triage reports no progress we could honestly
 * divide into quarters, and a bar that invents one is worse than one that
 * admits it is only saying "still working".
 */
export function Digesting({ className }: { className?: string }) {
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
      <span className="text-label-sm font-medium text-text-sub-600">
        Digesting…
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
