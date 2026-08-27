import { CATEGORY_STYLE } from "./categories";
import { ClearCache } from "./clear-cache";
import { Column } from "./layout-frame";
import * as Button from "@/app/component/ui/button";
import { CATEGORIES } from "@/lib/digest-ai";
import { cn } from "@/utils/cn";

const SCOPES = [
  "Message headers, subjects, bodies and dates",
  "Never sending, replying, deleting or archiving",
  "Summaries are generated per day and cached locally",
];

/**
 * The four lanes, before there is any mail to put in them — the tiles' colours
 * in the tiles' two-by-two, so the first screen after connecting is a shape
 * this one already showed. Built from `CATEGORIES`, so it cannot drift.
 */
function Lanes() {
  return (
    <div aria-hidden className="grid w-[70px] grid-cols-2 gap-1.5">
      {CATEGORIES.map((key) => (
        <span
          key={key}
          className={cn("size-8 rounded-[10px]", CATEGORY_STYLE[key].swatch)}
        />
      ))}
    </div>
  );
}

/** Signed-out screen: what the app reads, and the one button that starts OAuth. */
export function Connect({ error }: { error?: string | null }) {
  return (
    <Column id="content" className="flex flex-1 flex-col justify-center py-16">
      <ClearCache />
      <Lanes />

      <h1 className="mt-6 text-title-h4 tracking-[-0.035em] text-text-strong-950 md:text-title-h3">
        See what needs you.
        <br />
        Skip the rest.
      </h1>
      <p className="mt-3 max-w-prose text-paragraph-sm text-text-sub-600 md:text-paragraph-md">
        Daily Digest reads your Gmail and sorts each day by what it asks of you.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {SCOPES.map((scope) => (
          <li key={scope} className="flex items-start gap-2.5">
            <span className="mt-[7px] size-[5px] shrink-0 rounded-full bg-primary-base" />
            <span className="text-paragraph-sm text-text-sub-600">{scope}</span>
          </li>
        ))}
      </ul>

      {error && (
        <p className="mt-6 text-paragraph-sm text-error-base">{error}</p>
      )}

      <Button.Root
        asChild
        variant="primary"
        mode="filled"
        className="mt-7 w-full sm:w-auto sm:self-start sm:px-8"
      >
        <a href="/api/auth/google">Connect Gmail (read-only)</a>
      </Button.Root>
    </Column>
  );
}
