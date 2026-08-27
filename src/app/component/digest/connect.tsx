import { CATEGORY_STYLE } from "./categories";
import { ClearCache } from "./clear-cache";
import { Column } from "./layout-frame";
import * as Button from "@/app/component/ui/button";
import { CATEGORIES } from "@/lib/digest-ai";
import { cn } from "@/utils/cn";

const SCOPES = [
  "Highlighted priority and actionable emails",
  "Easy categories to follow and filter",
  "Summaries per day and message",
];

/**
 * The four lanes, before there is any mail to put in them — the tiles' hues in
 * the tiles' two-by-two, drained because there is nothing in them yet. Built
 * from `CATEGORIES`, so it cannot drift from the lanes themselves.
 */
function Lanes() {
  return (
    <div aria-hidden className="grid w-[70px] grid-cols-2 gap-1.5">
      {CATEGORIES.map((key) => (
        <span
          key={key}
          className={cn(
            "size-8 rounded-[10px]",
            CATEGORY_STYLE[key].swatchSoft,
          )}
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
        Digest reads your Gmail and shows your day at a glance.
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
        variant="neutral"
        mode="filled"
        className="mt-7 w-full sm:w-auto sm:self-start sm:px-8"
      >
        <a href="/api/auth/google">Connect Gmail</a>
      </Button.Root>
    </Column>
  );
}
