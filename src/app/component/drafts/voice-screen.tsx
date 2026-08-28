import { RiExternalLinkLine } from "@remixicon/react";
import Link from "next/link";
import * as React from "react";

import { Column } from "@/app/component/digest/layout-frame";
import * as Button from "@/app/component/ui/button";
import { gmailThreadUrl } from "@/lib/gmail-url";
import type { SentSample, Voice, VoiceStats } from "@/lib/voice";

/** A band of the page. Nothing renders when its half of the read came back empty. */
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-8">
      <h2 className="text-label-xs font-semibold uppercase tracking-[0.06em] text-text-soft-400">
        {title}
      </h2>
      {hint && (
        <p className="mt-1.5 text-paragraph-sm text-text-sub-600">{hint}</p>
      )}
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

/** Your own words, quoted back. Never translated: the wording is the point. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      translate="no"
      className="inline-flex max-w-full items-center break-words rounded-lg bg-bg-weak-50 px-2.5 py-1.5 text-label-sm text-text-strong-950"
    >
      {children}
    </span>
  );
}

function Chips({ items, quoted = false }: { items: string[]; quoted?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Chip key={item}>{quoted ? `“${item}”` : item}</Chip>
      ))}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-2.5 text-paragraph-sm text-text-sub-600"
        >
          <span
            aria-hidden
            className="mt-[7px] size-[5px] shrink-0 rounded-full bg-bg-soft-200"
          />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A named observation: the short label, and the sentence under it. */
function Notes({ items }: { items: { label: string; detail: string }[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.label}>
          <p className="text-label-sm font-semibold text-text-strong-950">
            {item.label}
          </p>
          <p className="mt-1 break-words text-paragraph-sm text-text-sub-600 text-pretty">
            {item.detail}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex h-[76px] flex-col justify-between rounded-2xl bg-bg-weak-50 p-3 md:h-[84px] md:p-4">
      <span className="block text-title-h5 font-semibold tabular-nums leading-none tracking-[-0.04em] text-text-strong-950 md:text-title-h4">
        {value}
      </span>
      <span className="text-label-xs font-medium text-text-sub-600 md:text-label-sm">
        {label}
      </span>
    </div>
  );
}

const shortDate = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

/** What was read, counted rather than inferred — true even with no API key. */
function Sample({ stats }: { stats: VoiceStats }) {
  const replies = new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(stats.replyShare);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Stat value={String(stats.analyzed)} label="Emails read" />
        <Stat value={String(stats.medianWords)} label="Median words" />
        <Stat value={replies} label="Replies" />
      </div>
      <p className="mt-2.5 text-label-xs text-text-soft-400">
        {stats.from === stats.to
          ? `Sent on ${shortDate(stats.to)}`
          : `Sent between ${shortDate(stats.from)} and ${shortDate(stats.to)}`}
        {stats.topRecipients.length > 0 &&
          `, mostly to ${stats.topRecipients
            .slice(0, 2)
            .map((person) => person.name)
            .join(" and ")}`}
      </p>
    </>
  );
}

/** The receipt: the newest few of the emails the voice was read from. */
function ReadFrom({
  recent,
  account,
}: {
  recent: SentSample[];
  account: string;
}) {
  return (
    <ul className="flex flex-col">
      {recent.map((message) => (
        <li key={message.id} className="border-b border-stroke-soft-200 last:border-0">
          <a
            href={gmailThreadUrl(message.threadId || message.id, account)}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-3 rounded-lg py-2.5 outline-none transition-colors duration-200 hover:bg-bg-weak-50 focus-visible:ring-2 focus-visible:ring-primary-alpha-24"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-label-sm text-text-strong-950">
                {message.subject}
              </span>
              <span className="mt-0.5 block truncate text-label-xs text-text-soft-400">
                To {message.toName} · {message.words}&nbsp;words
              </span>
            </span>
            <RiExternalLinkLine
              aria-hidden
              className="size-4 shrink-0 text-text-soft-400"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Nothing to read: an empty Sent folder, or nothing in it long enough. */
export function NoSentMail() {
  return (
    <Column className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <div aria-hidden className="flex w-[120px] flex-col gap-1.5">
        <span className="h-3 rounded-full bg-bg-weak-50" />
        <span className="h-3 w-3/4 rounded-full bg-bg-weak-50" />
        <span className="h-3 w-1/2 rounded-full bg-bg-weak-50/60" />
      </div>
      <p className="mt-6 text-title-h5 tracking-[-0.02em] text-text-strong-950">
        Nothing to read yet
      </p>
      <p className="mt-2 max-w-sm text-paragraph-sm text-text-sub-600">
        Your voice is read from the emails you write, and a one-line reply
        carries too little of it. Send a few from this account, then read again.
      </p>
      <Button.Root
        asChild
        variant="neutral"
        mode="stroke"
        size="medium"
        className="mt-6 px-6"
      >
        <Link href="/">Back to the digest</Link>
      </Button.Root>
    </Column>
  );
}

/** The sample was read but Claude was not reachable, so only counts are real. */
function Unread() {
  return (
    <div className="mt-5 rounded-2xl border border-stroke-soft-200 p-5">
      <p className="text-label-sm font-semibold text-text-strong-950">
        Your voice is still unread
      </p>
      <p className="mt-1.5 text-paragraph-sm text-text-sub-600">
        The counts above come straight from Gmail. Reading how you write needs
        Claude, so add <code>ANTHROPIC_API_KEY</code> to <code>.env</code>,
        restart the dev server, then read again.
      </p>
    </div>
  );
}

export function VoiceView({ voice }: { voice: Voice }) {
  const { stats, profile, recent, account } = voice;
  if (stats.analyzed === 0) return <NoSentMail />;

  return (
    <Column className="flex-1 pb-4">
      {profile.summary && (
        <p className="break-words pb-5 pt-5 text-paragraph-sm text-text-sub-600 text-pretty md:text-paragraph-md">
          {profile.summary}
        </p>
      )}

      <div className={profile.summary ? "" : "pt-5"}>
        <Sample stats={stats} />
      </div>

      {profile.source === "none" && <Unread />}

      {profile.traits.length > 0 && (
        <Section title="How you sound">
          <Notes items={profile.traits} />
        </Section>
      )}

      {(profile.openings.length > 0 || profile.signoffs.length > 0) && (
        <Section title="How you open & close">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="text-label-sm font-semibold text-text-strong-950">
                You open with
              </h3>
              <div className="mt-2">
                {profile.openings.length > 0 ? (
                  <Chips items={profile.openings} quoted />
                ) : (
                  <p className="text-paragraph-sm text-text-sub-600">
                    Nothing. You start straight in with the first sentence.
                  </p>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-label-sm font-semibold text-text-strong-950">
                You close with
              </h3>
              <div className="mt-2">
                {profile.signoffs.length > 0 ? (
                  <Chips items={profile.signoffs} quoted />
                ) : (
                  <p className="text-paragraph-sm text-text-sub-600">
                    Nothing. Your last line is the last thing you had to say.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Section>
      )}

      {profile.habits.length > 0 && (
        <Section title="Habits">
          <Bullets items={profile.habits} />
        </Section>
      )}

      {profile.phrases.length > 0 && (
        <Section title="Phrases you reach for">
          <Chips items={profile.phrases} quoted />
        </Section>
      )}

      {profile.registers.length > 0 && (
        <Section title="How it shifts" hint="The same voice, read for who it is for.">
          <Notes
            items={profile.registers.map((register) => ({
              label: register.audience,
              detail: register.detail,
            }))}
          />
        </Section>
      )}

      {profile.avoid.length > 0 && (
        <Section
          title="Never yours"
          hint="What would give a draft away as written by someone else."
        >
          <Bullets items={profile.avoid} />
        </Section>
      )}

      {recent.length > 0 && (
        <Section title="Read from" hint="The newest of the emails behind all this.">
          <ReadFrom recent={recent} account={account} />
        </Section>
      )}

      <p className="py-7 text-center text-label-xs text-text-soft-400">
        {profile.source === "claude"
          ? "Read by Claude. Drafting in this voice comes next."
          : "Drafting in this voice comes next."}
      </p>
    </Column>
  );
}
