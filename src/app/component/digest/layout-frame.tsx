import * as React from "react";

import type { DayDigest } from "@/lib/digest";

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

/**
 * Settings, provenance, and the way out. Everything here is nowrap by nature,
 * so a phone takes two rows and one line above `md`; `overflow-x-hidden` keeps
 * a long label from scrolling the whole page sideways.
 */
export function Footer({
  source,
  toggle,
}: {
  source?: DayDigest["source"];
  toggle?: React.ReactNode;
}) {
  const provenance =
    source === "claude"
      ? "Triaged by Claude"
      : source === "heuristic"
        ? "digest 📬"
        : "";

  return (
    <footer className="safe-bottom mt-auto overflow-x-hidden border-t border-stroke-soft-200">
      <Column className="flex flex-col gap-3 py-4 text-label-xs text-text-soft-400 md:flex-row md:items-center md:justify-between md:gap-6">
        {toggle && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            {toggle}
          </div>
        )}
        <div className="flex min-w-0 items-center justify-between gap-4 md:justify-end">
          <span className="min-w-0 truncate">{provenance}</span>
          <a href="/api/auth/logout" className="shrink-0 underline">
            Log out
          </a>
        </div>
      </Column>
    </footer>
  );
}
