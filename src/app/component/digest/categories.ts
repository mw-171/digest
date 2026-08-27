import type * as Avatar from "@/app/component/ui/avatar";
import type { Category } from "@/lib/digest-ai";

// One hue per lane, from the AlignUI ramps, so every mark for a category
// matches without a hard-coded hex.
export type CategoryStyle = {
  swatch: string;
  /** The same hue, drained. */
  swatchSoft: string;
  /** Drawn around the sender's face — where a card says which lane it is in. */
  ring: string;
  chip: string;
  /** Text at chip strength — readable on `chip`. */
  ink: string;
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
