"use client";

import * as React from "react";

import { CATEGORY_STYLE } from "./categories";
import * as Avatar from "@/app/component/ui/avatar";
import { cn } from "@/utils/cn";
import type { Category } from "@/lib/digest-ai";
import { senderLogoUrl } from "@/lib/grouping";

/** Initials for the sender, falling back to AlignUI's empty-user avatar. */
function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2);
  return `${words[0][0]}${words[words.length - 1][0]}`;
}

/**
 * The sender's face, ringed by the lane the message landed in. Brands get their
 * logo and people get initials — a read-only scope cannot fetch photos — so the
 * ring is what carries the category either way.
 */
export function SenderAvatar({
  name,
  email,
  category,
  size = "32",
  ring = true,
}: {
  name: string;
  /** The sender's address — where the logo comes from. */
  email?: string;
  category: Category;
  size?: React.ComponentProps<typeof Avatar.Root>["size"];
  /** Off where the surrounding UI already names the category. */
  ring?: boolean;
}) {
  const initials = initialsOf(name);
  const src = email ? senderLogoUrl(email) : null;
  // Remembering *which* logo failed rather than that one did means a new
  // sender in the same slot still gets its own attempt.
  const [failed, setFailed] = React.useState<string | null>(null);

  return (
    <Avatar.Root
      size={size}
      color={CATEGORY_STYLE[category].avatar}
      className={cn(
        ring && "ring-2 ring-offset-2 ring-offset-bg-white-0",
        ring && CATEGORY_STYLE[category].ring,
      )}
    >
      {src && failed !== src ? (
        <Avatar.Image
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
          className="bg-bg-white-0 object-contain p-1"
        />
      ) : (
        initials || undefined
      )}
    </Avatar.Root>
  );
}
