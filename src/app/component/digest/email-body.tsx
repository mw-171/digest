import * as React from "react";

import type { Block, ReadableBody, Run } from "@/lib/email-body";

/**
 * Renders {@link ReadableBody} blocks in the app's own type scale — the
 * sender's layout is already gone by this point (see `src/lib/email-body.ts`).
 * Images are dropped: without the layout they were cut for they say less than
 * the sentence beside them, and the originals are in Gmail.
 */

function Inline({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, index) =>
        run.href ? (
          <a
            key={index}
            href={run.href}
            target="_blank"
            rel="noreferrer nofollow"
            className="underline decoration-stroke-sub-300 underline-offset-2 hover:text-text-strong-950"
          >
            {run.text}
          </a>
        ) : (
          <React.Fragment key={index}>{run.text}</React.Fragment>
        ),
      )}
    </>
  );
}

const HEADING_STYLE: Record<number, string> = {
  1: "mt-7 text-title-h6 tracking-[-0.02em]",
  2: "mt-6 text-label-lg",
  3: "mt-5 text-label-md",
};

function BlockView({ block }: { block: Block }) {
  const runs = block.runs ?? [];
  if (block.kind === "image") return null;

  switch (block.kind) {
    case "rule":
      return <hr className="my-6 border-0 border-t border-stroke-soft-200" />;

    case "code":
      return (
        <pre className="mt-4 overflow-x-auto rounded-lg bg-bg-weak-50 p-4 text-paragraph-xs text-text-sub-600">
          {block.text}
        </pre>
      );

    case "heading":
      return (
        <p
          className={`break-words text-text-strong-950 text-pretty ${HEADING_STYLE[block.level ?? 2]}`}
        >
          <Inline runs={runs} />
        </p>
      );

    case "listItem":
      return (
        <div className="mt-2 flex gap-2.5 text-paragraph-md leading-relaxed text-text-strong-950">
          <span className="shrink-0 tabular-nums text-text-soft-400">
            {block.marker}
          </span>
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">
            <Inline runs={runs} />
          </span>
        </div>
      );

    default:
      return (
        // `whitespace-pre-line` is what keeps a signature or an address block
        // in the shape the sender gave it, without letting stray newlines
        // through as blank space.
        <p className="mt-4 whitespace-pre-line break-words text-paragraph-md leading-relaxed text-text-strong-950 text-pretty [overflow-wrap:anywhere]">
          <Inline runs={runs} />
        </p>
      );
  }
}

/** Consecutive quoted blocks travel together so they can fold into one panel. */
function groupQuoted(blocks: Block[]) {
  const groups: { quoted: boolean; blocks: Block[] }[] = [];

  for (const block of blocks.filter((block) => block.kind !== "image")) {
    const quoted = Boolean(block.quoted);
    const last = groups.at(-1);
    if (last && last.quoted === quoted) last.blocks.push(block);
    else groups.push({ quoted, blocks: [block] });
  }

  return groups;
}

export function EmailBody({
  body,
  fallback,
}: {
  body: ReadableBody;
  /** Shown when nothing readable came back — the Gmail snippet. */
  fallback: string;
}) {
  if (body.blocks.every((block) => block.kind === "image")) {
    return (
      <p className="mt-4 break-words text-paragraph-sm text-text-soft-400">
        {fallback}
      </p>
    );
  }

  return (
    <div className="mt-4">
      {groupQuoted(body.blocks).map((group, index) =>
        group.quoted ? (
          // The message being replied to: there, but out of the way.
          <details key={index} className="group mt-5">
            <summary className="cursor-pointer list-none text-label-xs text-text-soft-400 hover:text-text-sub-600">
              <span className="rounded-md bg-bg-weak-50 px-2 py-1">
                ••• quoted text
              </span>
            </summary>
            <div className="mt-2 border-l-2 border-stroke-soft-200 pl-4 text-text-sub-600 [&_p]:text-paragraph-sm">
              {group.blocks.map((block, key) => (
                <BlockView key={key} block={block} />
              ))}
            </div>
          </details>
        ) : (
          <React.Fragment key={index}>
            {group.blocks.map((block, key) => (
              <BlockView key={key} block={block} />
            ))}
          </React.Fragment>
        ),
      )}

      {body.truncated && (
        <p className="mt-6 text-label-xs text-text-soft-400">
          This email was longer. Open it in Gmail for the rest.
        </p>
      )}
    </div>
  );
}
