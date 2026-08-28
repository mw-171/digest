import { RiArrowDownSLine, RiExternalLinkLine } from "@remixicon/react";
import Link from "next/link";
import * as React from "react";

import { Column } from "@/app/component/digest/layout-frame";
import * as Button from "@/app/component/ui/button";
import { cn } from "@/utils/cn";
import { gmailThreadUrl } from "@/lib/gmail-url";
import type { SentSample, Voice, VoiceStats } from "@/lib/voice";
import type { VoiceProfile } from "@/lib/voice-ai";

/**
 * A band of the full read. The rule and a heading at label weight rather than
 * a row of grey capitals: seven sections in a row need to be told apart at a
 * glance, and a hint under the title says what belongs in one.
 */
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
    <section className="mt-7 border-t border-stroke-soft-200 pt-5 first:mt-5">
      <h2 className="text-label-md font-semibold text-text-strong-950">
        {title}
      </h2>
      {hint && (
        <p className="mt-1 text-paragraph-sm text-text-soft-400">{hint}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * The read in three or four lines, which is the whole page for most visits.
 * Bullets rather than a paragraph: this sits at the very top, and a block of
 * prose there is the one thing nobody reads.
 */
function Lead({ lines }: { lines: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5 pb-6 pt-5">
      {lines.map((line) => (
        <li
          key={line}
          className="flex gap-3 text-paragraph-sm text-text-strong-950 md:text-paragraph-md"
        >
          <span
            aria-hidden
            className="mt-[8px] size-1.5 shrink-0 rounded-full bg-primary-base md:mt-[10px]"
          />
          <span className="min-w-0 break-words text-pretty">{line}</span>
        </li>
      ))}
    </ul>
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

/** One line of the glance: what it is, and your own words for it. */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 sm:gap-4">
      {/* Beside the value, not above it — four stacked rows push the rest of
          the page off a phone screen, which is the one thing this has to fit
          on. The padding sits the label on the chips' first line. */}
      <dt className="w-[74px] shrink-0 pt-[7px] text-label-xs font-medium uppercase tracking-[0.06em] text-text-soft-400 sm:w-[108px]">
        {label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

/**
 * The whole read in four lines. Everything here is also in the full version
 * below, at length — this is the part that has to fit on a phone without
 * scrolling, so it is the labels and your own words and nothing else.
 */
function Glance({ profile }: { profile: VoiceProfile }) {
  const rows: { label: string; items: string[]; quoted: boolean }[] = [
    { label: "Opens with", items: profile.openings.slice(0, 2), quoted: true },
    { label: "Closes with", items: profile.signoffs.slice(0, 2), quoted: true },
    {
      label: "Tone",
      items: profile.traits.slice(0, 3).map((trait) => trait.label),
      quoted: false,
    },
    { label: "Reaches for", items: profile.phrases.slice(0, 3), quoted: true },
  ].filter((row) => row.items.length > 0);

  if (rows.length === 0) return null;

  return (
    <dl className="mt-6 divide-y divide-stroke-soft-200 border-y border-stroke-soft-200">
      {rows.map((row) => (
        <Row key={row.label} label={row.label}>
          <Chips items={row.items} quoted={row.quoted} />
        </Row>
      ))}
    </dl>
  );
}

/**
 * Everything the glance left out, folded away. A native `details` rather than
 * a toggle of our own: it opens without JavaScript, it is a disclosure to a
 * screen reader for free, and nothing about the page depends on its state.
 */
function More({ children }: { children: React.ReactNode }) {
  return (
    <details className="group mt-7 border-t border-stroke-soft-200">
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-3",
          "text-label-sm font-medium text-text-strong-950 outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary-alpha-24",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="group-open:hidden">See the full read</span>
        <span className="hidden group-open:inline">Hide the full read</span>
        <RiArrowDownSLine
          aria-hidden
          className="size-4 shrink-0 text-text-soft-400 transition-transform duration-200 ease-out group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="pb-2">{children}</div>
    </details>
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
      {profile.summary.length > 0 && <Lead lines={profile.summary} />}

      <div className={profile.summary.length > 0 ? "" : "pt-5"}>
        <Sample stats={stats} />
      </div>

      {profile.source === "none" && <Unread />}

      <Glance profile={profile} />

      <More>
        {profile.traits.length > 0 && (
          <Section title="Tone" hint="What a reader notices first.">
            <Notes items={profile.traits} />
          </Section>
        )}

        {(profile.openings.length > 0 || profile.signoffs.length > 0) && (
          <Section title="Openings & sign-offs" hint="Every greeting and closing you use, most frequent first.">
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
          <Section title="Habits" hint="The mechanics: length, punctuation, capitalisation.">
            <Bullets items={profile.habits} />
          </Section>
        )}

        {profile.phrases.length > 0 && (
          <Section title="Phrases" hint="Words you come back to again and again.">
            <Chips items={profile.phrases} quoted />
          </Section>
        )}

        {profile.registers.length > 0 && (
          <Section title="By audience" hint="How the voice changes with who it is for.">
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
          <Section title="Emails read" hint="The newest of the ones behind all this.">
            <ReadFrom recent={recent} account={account} />
          </Section>
        )}
      </More>

      <p className="py-7 text-center text-label-xs text-text-soft-400">
        Mail that needs a reply carries a Draft button on the{" "}
        <Link href="/" className="underline">
          digest
        </Link>
        .
      </p>
    </Column>
  );
}
