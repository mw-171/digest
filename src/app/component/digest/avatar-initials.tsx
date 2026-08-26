"use client";

import * as React from "react";

import * as Avatar from "@/app/component/ui/avatar";
import type { Band } from "@/lib/digest-ai";
import { senderLogoUrl } from "@/lib/grouping";

/** Initials for the sender, falling back to AlignUI's empty-user avatar. */
function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2);
  return `${words[0][0]}${words[words.length - 1][0]}`;
}

/**
 * The same purple twice, at two strengths: FYI is quieter than Needs You
 * without becoming a different colour. Only noise is grey — it was never read.
 */
const TONE: Record<
  Band,
  { color: React.ComponentProps<typeof Avatar.Root>["color"]; className?: string }
> = {
  needs: { color: "purple" },
  fyi: { color: "purple", className: "bg-purple-100 text-purple-900" },
  noise: { color: "gray" },
};

export function SenderAvatar({
  name,
  email,
  band,
  size = "32",
}: {
  name: string;
  /** The sender's address — where the logo comes from. */
  email?: string;
  band: Band;
  size?: React.ComponentProps<typeof Avatar.Root>["size"];
}) {
  const initials = initialsOf(name);
  const src = email ? senderLogoUrl(email) : null;
  // Remembering *which* logo failed rather than that one did means a new
  // sender in the same slot still gets its own attempt.
  const [failed, setFailed] = React.useState<string | null>(null);

  const tone = TONE[band];

  return (
    <Avatar.Root size={size} color={tone.color} className={tone.className}>
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
