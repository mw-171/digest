import type * as Avatar from "@/app/component/ui/avatar";
import type { Category } from "@/lib/digest-ai";

/**
 * The four lanes, as colour — one hue each from the AlignUI ramps, so a tile,
 * ring, avatar and chip in the same category match without a hard-coded hex.
 * Work carries the app's accent because it is why people open the digest;
 * Social is grey because nobody reads it.
 */
export type CategoryStyle = {
  /** The solid swatch: the tile's chip and the stacked volume bar. */
  swatch: string;
  /** The same hue, drained. For marks that stand for a lane rather than fill it. */
  swatchSoft: string;
  /**
   * The circle drawn around the sender's face. This is where a card says
   * which lane it belongs to — a bar down the card's edge said the same thing
   * louder, and in a stack of ten it read as a stack of ten highlights.
   */
  ring: string;
  /** A quiet fill for the category chip on the detail page. */
  chip: string;
  /** Text at chip strength — readable on `chip`. */
  ink: string;
  /** Which of AlignUI's avatar colours the sender's face borrows. */
  avatar: React.ComponentProps<typeof Avatar.Root>["color"];
};

export const CATEGORY_STYLE: Record<Category, CategoryStyle> = {
  work: {
    swatch: "bg-primary-base",
    swatchSoft: "bg-primary-lighter",
    ring: "ring-primary-base",
    chip: "bg-primary-alpha-10",
    ink: "text-primary-dark",
    avatar: "purple",
  },
  meetings: {
    swatch: "bg-blue-400",
    swatchSoft: "bg-blue-200",
    ring: "ring-blue-400",
    chip: "bg-blue-alpha-10",
    ink: "text-blue-700",
    avatar: "blue",
  },
  updates: {
    swatch: "bg-yellow-600",
    swatchSoft: "bg-yellow-200",
    ring: "ring-yellow-600",
    chip: "bg-yellow-alpha-10",
    ink: "text-yellow-900",
    avatar: "yellow",
  },
  social: {
    swatch: "bg-text-soft-400",
    swatchSoft: "bg-bg-soft-200",
    ring: "ring-bg-sub-300",
    chip: "bg-bg-weak-50",
    ink: "text-text-sub-600",
    avatar: "gray",
  },
};

/** One line on what belongs in a lane. Shown when a tile is empty or filtered. */
export const CATEGORY_BLURB: Record<Category, string> = {
  work: "Things waiting on you",
  meetings: "Invitations, agendas and notes",
  updates: "Receipts, statements and lists",
  social: "Promotions and everything selling",
};
