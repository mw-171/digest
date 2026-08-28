import Link from "next/link";
import * as React from "react";

import { cn } from "@/utils/cn";

/**
 * Page frame. The whole page scrolls — the header stays put by being sticky —
 * so this is one column that widens with the viewport rather than a phone
 * screen pinned to the middle of a desktop monitor.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-white-0">
      <a
        href="#content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-lg focus-visible:bg-bg-strong-950 focus-visible:px-4 focus-visible:py-2 focus-visible:text-label-sm focus-visible:text-text-white-0"
      >
        Skip to content
      </a>
      {children}
    </div>
  );
}

/** Content column. Every band of the page shares this width and padding. */
export function Column({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`mx-auto w-full min-w-0 max-w-[440px] px-6 md:max-w-3xl md:px-10 lg:max-w-5xl lg:px-12 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/** The two things this app is: the day that arrived, and the way you write. */
const TABS = [
  { key: "digest", label: "Digest", href: "/" },
  { key: "drafts", label: "Drafts", href: "/drafts" },
] as const;

export type FooterTab = (typeof TABS)[number]["key"];

/**
 * Real links, so Cmd-click and middle-click work. The padding is what makes a
 * 44px target out of a 16px word, and the negative margin pulls the first one
 * back onto the column's edge so the row still reads as aligned.
 */
function Tabs({ active }: { active: FooterTab }) {
  return (
    <nav aria-label="Sections" className="-ml-2.5 flex items-center gap-0.5">
      {TABS.map((tab) => {
        const current = tab.key === active;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-lg px-2.5 text-label-sm md:min-h-9",
              "touch-manipulation transition-colors duration-200 ease-out",
              "outline-none focus-visible:ring-2 focus-visible:ring-primary-alpha-24",
              current
                ? "bg-bg-weak-50 font-medium text-text-strong-950"
                : "text-text-soft-400 hover:text-text-sub-600",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Where you are, and the way out — one row, on every width. Everything in it
 * is nowrap by nature, so `overflow-x-hidden` keeps a long label from
 * scrolling the whole page sideways.
 */
export function Footer({
  toggle,
  active = "digest",
}: {
  toggle?: React.ReactNode;
  /** Which tab is the page under it. */
  active?: FooterTab;
}) {
  return (
    <footer className="safe-bottom mt-auto overflow-x-hidden border-t border-stroke-soft-200">
      <Column className="flex items-center justify-between gap-4 py-2 text-label-xs text-text-soft-400">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          <Tabs active={active} />
          {toggle}
        </div>
        <a
          href="/api/auth/logout"
          className="flex min-h-11 shrink-0 items-center rounded-lg underline outline-none focus-visible:ring-2 focus-visible:ring-primary-alpha-24"
        >
          Log out
        </a>
      </Column>
    </footer>
  );
}
