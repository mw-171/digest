"use client";

import * as Button from "@/app/component/ui/button";

/**
 * A failed fetch, with the way out when the failure is the connection itself.
 * Shared by every tab: they all read the same mailbox behind the same token.
 */
export function ErrorPanel({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  const reconnect =
    typeof error === "object" && error !== null && "reconnect" in error
      ? Boolean((error as { reconnect: unknown }).reconnect)
      : false;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-8 py-12">
      <p className="text-paragraph-sm text-error-base">{message}</p>
      {reconnect && (
        <Button.Root asChild variant="primary" mode="filled" className="mt-5">
          <a href="/api/auth/google">Reconnect Gmail</a>
        </Button.Root>
      )}
    </div>
  );
}
