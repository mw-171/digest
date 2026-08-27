import { CATEGORY_STYLE } from "./categories";
import type { Category } from "@/lib/digest-ai";
import { cn } from "@/utils/cn";

/**
 * The four lanes, in declaration order. Taken from the style map rather than
 * `CATEGORIES`, because that module reaches the Anthropic SDK and
 * `node:crypto` — a value import would drag both into the browser bundle.
 */
const LANES = Object.keys(CATEGORY_STYLE) as Category[];

/** How long one lap of the four takes. */
const CYCLE_MS = 1800;

/**
 * Where each square falls in the lap. The grid fills in reading order, so
 * running in that order drags the glow in a Z; sending the third beat to the
 * bottom-right and the fourth to the bottom-left makes it a circle.
 */
const CLOCKWISE = [0, 1, 3, 2];

/**
 * What the app is doing while you wait: four squares, one per lane, with a glow
 * travelling the ring and brightening each in its own colour. It laps rather
 * than advances, because triage reports no progress we could honestly divide
 * into quarters.
 */
export function Digesting({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center gap-3", className)}
    >
      <div aria-hidden className="grid w-[42px] grid-cols-2 gap-1.5">
        {LANES.map((key, index) => (
          <span
            key={key}
            className={cn(
              "relative size-[18px] rounded-[6px]",
              CATEGORY_STYLE[key].swatchSoft,
            )}
          >
            {/* The lane at full strength, rising and falling over its own
                drained colour all the way round the ring. Opacity only — the
                two layers are the same hue, so every value between them is a
                shade of this lane rather than a blend of two. */}
            <span
              className={cn(
                "digest-flash absolute inset-0 rounded-[6px]",
                CATEGORY_STYLE[key].swatch,
              )}
              style={{
                animation: `digest-flash ${CYCLE_MS}ms linear infinite`,
                animationDelay: `${
                  (CLOCKWISE[index] * CYCLE_MS) / CLOCKWISE.length
                }ms`,
              }}
            />
          </span>
        ))}
      </div>

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
 * blurred content, and the header's `z-10` keeps it above both.
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
      {/* Fades in with the blur behind it rather than appearing on top of a
          page that is still sharpening. */}
      <Digesting className="animate-in fade-in-0 duration-300" />
    </div>
  );
}

/**
 * Always on the content box, never conditional: a transition can only animate
 * a change if it is already there when the change happens. Inside the blur
 * strings it was removed with them, and content snapped into focus.
 */
export const BUSY_TRANSITION =
  "transition-[filter,opacity] duration-500 ease-out";

/**
 * Blur for content being replaced. Heavier than the skeleton's, because there
 * is something legible underneath that would otherwise invite reading.
 */
export const BUSY_BLUR = "blur-[3px] opacity-80";

/**
 * Blur for a cold start. Only a skeleton underneath, so this is a softening
 * rather than a screen: enough to push the shapes back behind the indicator.
 */
export const COLD_BLUR = "blur-[1.5px] opacity-85";
