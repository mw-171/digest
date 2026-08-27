import type { DigestItem } from "@/lib/digest";

// Threads and senders come free with every message, so grouping on them costs
// one pass and cannot hallucinate.

export type Thread = {
  /** The Gmail thread id, or the message id for a message standing alone. */
  id: string;
  /** `subject`, minus the boilerplate its group shares. */
  title: string;
  items: DigestItem[];
  latest: DigestItem;
  participants: string[];
  /** What the thread is called: the root subject, minus the Re:/Fwd: crust. */
  subject: string;
  count: number;
};

/** One sender, or the bucket the one-offs were swept into. */
export type GroupKind = "sender" | "promotions" | "social" | "forums" | "mixed";

export type SenderGroup = {
  /** Root domain, or "" for the remainder bucket. */
  key: string;
  kind: GroupKind;
  label: string;
  /** Two to four words on what this pile is, read off the data. */
  descriptor: string;
  threads: Thread[];
  count: number;
};

/** Suffixes that are a registry, not a company: acme.co.uk needs three parts. */
const TWO_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "co.jp", "or.jp", "ne.jp", "co.nz",
  "co.za", "com.au", "net.au", "org.au", "com.br", "com.mx", "com.sg",
  "com.hk", "com.tw", "com.tr", "co.in", "co.kr", "co.il",
]);

// Bounce subdomains stripped: `email.acme.com` and `mail.acme.com` are one
// company and belong on one row.
export function senderDomain(email: string) {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain || !domain.includes(".")) return "";

  const parts = domain.split(".");
  const keep = TWO_PART_SUFFIXES.has(parts.slice(-2).join(".")) ? 3 : 2;
  return parts.length > keep ? parts.slice(-keep).join(".") : domain;
}

// Consumer providers. A logo here would be Gmail's, not the person's.
const MAILBOX_PROVIDERS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "msn.com", "yahoo.com", "ymail.com", "icloud.com", "me.com", "mac.com",
  "aol.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.de",
  "mail.com", "zoho.com", "fastmail.com", "hey.com", "qq.com", "163.com",
  "yandex.ru", "mail.ru",
]);

// A brand's logo, from its domain. Null for people, who fall back to initials —
// a read-only scope gives us no contact photos.
export function senderLogoUrl(email: string) {
  const domain = senderDomain(email);
  if (!domain || MAILBOX_PROVIDERS.has(domain)) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

// `Re: Fwd: Deploy failed` → `Deploy failed`. Bracketed prefixes stay: whether
// one is boilerplate depends on the group, which {@link groupBySender} knows.
export function normalizeSubject(subject: string) {
  let value = subject.trim();
  let previous = "";

  while (value !== previous) {
    previous = value;
    value = value
      .replace(/^(re|fwd?|aw|sv|vs|antwort)\s*(\[\d+\])?\s*:\s*/i, "")
      .trim();
  }

  return value || subject.trim();
}

/** One entry per conversation, newest first. A thread of one is still a thread. */
export function threadsOf(items: DigestItem[]): Thread[] {
  const byThread = new Map<string, DigestItem[]>();

  for (const item of items) {
    const key = item.threadId || item.id;
    const existing = byThread.get(key);
    if (existing) existing.push(item);
    else byThread.set(key, [item]);
  }

  return [...byThread.entries()].map(([id, members]) => {
    const subject = normalizeSubject(members[members.length - 1].subject);
    const participants: string[] = [];
    for (const member of members) {
      if (member.from && !participants.includes(member.from)) {
        participants.push(member.from);
      }
    }

    return {
      id,
      items: members,
      latest: members[0],
      participants,
      // The last member is the oldest, so its subject is the one the thread
      // was started under rather than whatever the latest reply renamed it to.
      subject,
      title: subject,
      count: members.length,
    };
  });
}

/** "Max Jiang, Vidu +1" — who is in the conversation, at a glance. */
export function participantLabel(participants: string[], limit = 2) {
  if (participants.length === 0) return "";
  const shown = participants.slice(0, limit).join(", ");
  const rest = participants.length - limit;
  return rest > 0 ? `${shown} +${rest}` : shown;
}

const CATEGORY_LABELS: Record<string, string> = {
  promotions: "Promotions",
  social: "Social",
  forums: "Forums",
  updates: "Updates",
  personal: "Everything else",
};

/** Capitalisation a machine will not guess. */
const BRANDS: Record<string, string> = {
  "github.com": "GitHub",
  "gitlab.com": "GitLab",
  "linkedin.com": "LinkedIn",
  "youtube.com": "YouTube",
  "paypal.com": "PayPal",
  "tiktok.com": "TikTok",
  "dropbox.com": "Dropbox",
  "figma.com": "Figma",
  "notion.so": "Notion",
  "openai.com": "OpenAI",
  "anthropic.com": "Anthropic",
  "airbnb.com": "Airbnb",
  "ebay.com": "eBay",
  "doordash.com": "DoorDash",
  "substack.com": "Substack",
  "eventbrite.com": "Eventbrite",
};

/** Title Case for a bare domain: `linear.app` → `Linear`. */
function fromDomain(domain: string) {
  const known = BRANDS[domain];
  if (known) return known;
  const name = domain.split(".")[0] ?? domain;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** The characters every string starts with, cut back to a word boundary. */
function commonPrefix(values: string[]) {
  if (values.length < 2) return "";

  let prefix = values[0];
  for (const value of values.slice(1)) {
    let index = 0;
    while (index < prefix.length && prefix[index] === value[index]) index++;
    prefix = prefix.slice(0, index);
    if (!prefix) return "";
  }

  // Cut at the last separator so a shared prefix never ends mid-word: two
  // subjects about "Deploy failed" and "Deploy fixed" share "Deploy f".
  const cut = Math.max(
    prefix.lastIndexOf(" "),
    prefix.lastIndexOf("]"),
    prefix.lastIndexOf(":"),
  );
  const trimmed = cut > 0 ? prefix.slice(0, cut + 1) : "";
  // Boilerplate is worth cutting; two shared characters are not.
  return trimmed.trim().length >= 4 ? trimmed : "";
}

// The boilerplate every subject shares is usually a repo or a list name.
// Failing that, who signed the mail.
function describeGroup(threads: Thread[], prefix: string) {
  const shared = prefix.replace(/[[\]():\s]+/g, " ").trim();
  if (shared) {
    // A path reads better as its last segment: hackathon/my.site → my.site
    const leaf = shared.split("/").filter(Boolean).pop() ?? shared;
    return leaf.split(/\s+/).slice(0, 3).join(" ");
  }

  const names: string[] = [];
  for (const thread of threads) {
    for (const item of thread.items) {
      if (item.from && !names.includes(item.from)) names.push(item.from);
    }
  }

  if (names.length > 1) return names.slice(0, 2).join(", ");
  return threads.length > 1 ? `${threads.length} threads` : "";
}

// A display name beats a domain, but only when the group agrees on one — or a
// pile of PR mail gets labelled after the busiest colleague.
function groupLabel(threads: Thread[], domain: string) {
  const counts = new Map<string, number>();
  let total = 0;

  for (const thread of threads) {
    for (const item of thread.items) {
      counts.set(item.from, (counts.get(item.from) ?? 0) + 1);
      total++;
    }
  }

  // A sender that signs with its own name — "GitHub" from github.com — is the
  // best label going, however many colleagues also post to the thread.
  const label = domain.split(".")[0];
  const branded = [...counts.keys()].find(
    (name) => name.toLowerCase().replace(/\s+/g, "") === label,
  );
  if (branded) return branded;

  const [name, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  return count / total >= 0.6 && name ? name : fromDomain(domain);
}

// Biggest first. One-message senders are swept into a remainder row: forty
// rows of one is the wall this view replaces.
/**
 * A group's descriptor, and its threads with the shared boilerplate cut off
 * the front of every title. Thirty rows that all begin
 * "[hackathon/my.hackthenorth.com]" are thirty rows saying one thing once.
 */
function titled(threads: Thread[]) {
  const prefix = commonPrefix(threads.map((thread) => thread.subject));

  return {
    descriptor: describeGroup(threads, prefix),
    threads: prefix
      ? threads.map((thread) => ({
          ...thread,
          title: thread.subject.slice(prefix.length).trim() || thread.subject,
        }))
      : threads,
  };
}

export function groupBySender(threads: Thread[], minGroup = 2): SenderGroup[] {
  const byDomain = new Map<string, Thread[]>();

  for (const thread of threads) {
    const domain = senderDomain(thread.latest.fromEmail);
    const existing = byDomain.get(domain);
    if (existing) existing.push(thread);
    else byDomain.set(domain, [thread]);
  }

  const groups: SenderGroup[] = [];
  const remainder: Thread[] = [];

  for (const [domain, group] of byDomain) {
    const count = group.reduce((sum, thread) => sum + thread.count, 0);
    if (!domain || count < minGroup) {
      remainder.push(...group);
      continue;
    }

    groups.push({
      key: domain,
      kind: "sender",
      label: groupLabel(group, domain),
      ...titled(group),
      count,
    });
  }

  groups.sort((a, b) => b.count - a.count);

  if (remainder.length) {
    const tabs = new Set(remainder.map((thread) => thread.latest.tab));
    const only = tabs.size === 1 ? [...tabs][0] : "";
    const kind: GroupKind =
      only === "promotions" || only === "social" || only === "forums"
        ? only
        : "mixed";

    groups.push({
      key: "",
      kind,
      label: (only && CATEGORY_LABELS[only]) || "Everything else",
      ...titled(remainder),
      count: remainder.reduce((sum, thread) => sum + thread.count, 0),
    });
  }

  return groups;
}

/** The pile in one line. Templated: arithmetic cannot invent a sender. */
export function describeGroups(groups: SenderGroup[]) {
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  if (total === 0) return "";

  const [top] = groups;
  const closer = "Nothing needs you.";

  if (top.count / total > 0.6) {
    // "Mostly LinkedIn 2 threads" is a worse sentence than "Mostly LinkedIn":
    // a descriptor that is only a count says nothing the rows don't.
    const descriptor = /^\d+ threads?$/.test(top.descriptor) ? "" : top.descriptor;
    return `Mostly ${[top.label, descriptor].filter(Boolean).join(" ")}. ${closer}`;
  }

  if (groups.length <= 2) {
    return `${groups.map((group) => group.label).join(" and ")}. ${closer}`;
  }

  return `${top.label}, ${groups[1].label}, and ${groups.length - 2} more. ${closer}`;
}
