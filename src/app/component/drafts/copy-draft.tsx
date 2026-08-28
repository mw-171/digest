"use client";

import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import * as React from "react";

import * as Button from "@/app/component/ui/button";

/** How long the button admits it worked before going back to its job. */
const CONFIRM_MS = 2000;

/**
 * The draft, onto the clipboard. Gmail is connected read-only, so copying is
 * the whole delivery mechanism — this is the button that ships the feature.
 */
export function CopyDraft({ text }: { text: string }) {
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle");

  React.useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      // A browser that refuses the clipboard is not an error worth a dialog:
      // the draft is on screen and can be selected.
      setState("failed");
    }
  };

  return (
    <>
      <Button.Root
        variant="neutral"
        mode="stroke"
        size="xsmall"
        onClick={copy}
        className="w-[104px] justify-center"
      >
        <Button.Icon as={state === "copied" ? RiCheckLine : RiFileCopyLine} />
        {state === "copied" ? "Copied" : "Copy draft"}
      </Button.Root>

      {/* Announced rather than shown twice: the label already changed. */}
      <span aria-live="polite" className="sr-only">
        {state === "copied" ? "Draft copied to the clipboard" : ""}
      </span>
      {state === "failed" && (
        <span className="text-label-xs text-text-sub-600">
          Copying was blocked. Select the draft above instead.
        </span>
      )}
    </>
  );
}
