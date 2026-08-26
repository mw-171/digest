import * as Button from "@/app/component/ui/button";

const SCOPES = [
  "Message headers, subjects, bodies and dates",
  "Never sending, replying, deleting or archiving",
  "Summaries are generated per day and cached locally",
];

/** Signed-out screen: what the app reads, and the one button that starts OAuth. */
export function Connect({ error }: { error?: string | null }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-8 py-16">
      <div aria-hidden className="flex h-14 items-end gap-[5px]">
        <span className="h-[26px] w-[15px] rounded-[5px] bg-primary-alpha-16" />
        <span className="h-[44px] w-[15px] rounded-[5px] bg-primary-base" />
        <span className="h-[34px] w-[15px] rounded-[5px] bg-primary-alpha-16" />
        <span className="h-[56px] w-[15px] rounded-[5px] bg-bg-strong-950" />
      </div>

      <h1 className="mt-6 text-title-h5 tracking-[-0.03em] text-text-strong-950">
        See what needs you.
        <br />
        Skip the rest.
      </h1>
      <p className="mt-3 text-paragraph-sm text-text-sub-600">
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

      <Button.Root asChild variant="primary" mode="filled" className="mt-7 w-full sm:w-auto sm:self-start sm:px-8">
        <a href="/api/auth/google">Connect Gmail (read-only)</a>
      </Button.Root>
    </div>
  );
}
