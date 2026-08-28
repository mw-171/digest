"use client";

import { useQuery } from "@tanstack/react-query";
import { RiRefreshLine } from "@remixicon/react";

import { VoiceSkeleton } from "./voice-skeleton";
import { VoiceView } from "./voice-screen";
import {
  DigestingOverlay,
  VOICE_LABELS,
} from "@/app/component/digest/digesting";
import { ErrorPanel } from "@/app/component/digest/error-panel";
import {
  FADE_MS,
  useHydrated,
  useLingering,
} from "@/app/component/digest/loading-state";
import { Column, Footer, Shell } from "@/app/component/digest/layout-frame";
import * as Button from "@/app/component/ui/button";
import { cn } from "@/utils/cn";
import { voiceQuery } from "@/lib/digest-query";

/** The way you write, read off your own sent mail. */
export function DraftsClient() {
  const voice = useQuery(voiceQuery());

  const hydrated = useHydrated();
  const data = hydrated ? voice.data : undefined;
  const cold = data === undefined && !voice.isError;

  // The skeleton outlives the wait so it can fade out; unmounting is not a fade.
  const layer = useLingering(cold, FADE_MS);

  // A read already on screen stays there while the next one lands, so the
  // button is only ever a refresh and never a blank page.
  const rereading = voice.isFetching && !cold;

  return (
    <Shell>
      <header className="safe-top sticky top-0 z-10 border-b border-stroke-soft-200 bg-bg-white-0">
        <Column className="pb-4 md:pb-5 md:pt-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-title-h4 tracking-[-0.035em] text-text-strong-950 md:text-title-h3">
                Drafts
              </h1>
              <p className="mt-1.5 text-paragraph-sm text-text-sub-600">
                How you write, taken from emails you&apos;ve sent.
              </p>
            </div>
            <Button.Root
              variant="neutral"
              mode="stroke"
              size="xsmall"
              // Fixed width: the label changes while it works, and a button
              // that resizes under the cursor is a button you miss.
              className="mt-1 w-[116px] shrink-0 justify-center"
              disabled={voice.isFetching}
              onClick={() => voice.refetch()}
            >
              <Button.Icon
                as={RiRefreshLine}
                className={cn(
                  rereading && "animate-spin motion-reduce:animate-none",
                )}
              />
              {rereading ? "Reading…" : "Read again"}
            </Button.Root>
          </div>
        </Column>
      </header>

      {voice.isError ? (
        <ErrorPanel error={voice.error} />
      ) : (
        <main id="content" className="relative flex flex-1 flex-col">
          <div className="flex flex-1 flex-col">
            {data ? <VoiceView voice={data} /> : <div className="flex-1" />}
          </div>

          {/* Over the content, not instead of it, so the swap is one fade with
              nothing blank in the middle. */}
          {layer && (
            <div
              className={cn(
                "absolute inset-0 overflow-hidden bg-bg-white-0",
                "transition-opacity duration-500 ease-out",
                cold ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <VoiceSkeleton />
              <DigestingOverlay
                visible={cold}
                labels={VOICE_LABELS}
                status="Reading how you write"
              />
            </div>
          )}
        </main>
      )}

      <Footer active="drafts" />
    </Shell>
  );
}

