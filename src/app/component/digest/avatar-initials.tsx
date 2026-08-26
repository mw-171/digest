"use client";

import * as React from "react";

import * as Avatar from "@/app/component/ui/avatar";
import type { Band } from "@/lib/digest-ai";

/** Initials for the sender, falling back to AlignUI's empty-user avatar. */
function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2);
  return `${words[0][0]}${words[words.length - 1][0]}`;
}

const COLOR: Record<Band, React.ComponentProps<typeof Avatar.Root>["color"]> = {
  needs: "purple",
  notifications: "gray",
  noise: "gray",
};

/**
 * Mail from a person comes from one of these; mail from a brand does not. A
 * logo for a colleague's personal address would just be their provider's, so
 * these addresses keep their initials.
 */
const MAILBOX_PROVIDERS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "msn.com", "yahoo.com", "ymail.com", "icloud.com", "me.com", "mac.com",
  "aol.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.de",
  "mail.com", "zoho.com", "fastmail.com", "hey.com", "qq.com", "163.com",
  "yandex.ru", "mail.ru",
]);

/** Suffixes that are a registry, not a company: acme.co.uk needs three parts. */
const TWO_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "co.jp", "or.jp", "ne.jp", "co.nz",
  "co.za", "com.au", "net.au", "org.au", "com.br", "com.mx", "com.sg",
  "com.hk", "com.tw", "com.tr", "co.in", "co.kr", "co.il",
]);

/**
 * The sender's picture, which for mail is their domain's: brands are the
 * senders you actually recognise by sight, and Gmail's read-only scope gives
 * us no contact photos. Anything without a usable logo — a person, a domain
 * Google has never indexed — falls back to initials, and so does a load that
 * fails, so the row never sits empty.
 */
function logoUrl(fromEmail: string) {
  const domain = fromEmail.split("@")[1]?.toLowerCase().trim();
  if (!domain || !domain.includes(".") || MAILBOX_PROVIDERS.has(domain)) {
    return null;
  }
  // Strip the bounce subdomains bulk senders use (email.acme.com, mail.acme.com)
  // so the logo comes from the brand's own domain — while leaving the second
  // half of a two-part suffix alone, or every .co.uk sender would ask Google
  // for the logo of "co.uk".
  const parts = domain.split(".");
  const suffix = parts.slice(-2).join(".");
  const keep = TWO_PART_SUFFIXES.has(suffix) ? 3 : 2;
  const root = parts.length > keep ? parts.slice(-keep).join(".") : domain;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(root)}&sz=128`;
}

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
  const src = email ? logoUrl(email) : null;
  // Remembering *which* logo failed rather than that one did means a new
  // sender in the same slot still gets its own attempt.
  const [failed, setFailed] = React.useState<string | null>(null);

  return (
    <Avatar.Root size={size} color={COLOR[band]}>
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
