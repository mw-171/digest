import type { NextRequest } from "next/server";
import { z } from "zod";

import { draftReply } from "@/lib/draft-ai";
import { plainText } from "@/lib/email-body";
import { fetchAccountEmail, fetchMessage } from "@/lib/gmail";
import { authorizedClient, isAuthError } from "@/lib/google";
import { json } from "@/lib/http";

/**
 * One reply, written in the voice the browser sends with it. Nothing here is
 * cached on the server, because in production there is nowhere to cache it:
 * the answer is kept in the caller's query cache instead, keyed on the message
 * and the voice, so a draft is paid for once.
 */
export const dynamic = "force-dynamic";

/**
 * Opus writing a whole email takes longer than a platform's default cutoff.
 * Raise it to 300 if the deployment plan allows; 60 is the value every plan
 * accepts, so it is the one that is safe to ship.
 */
export const maxDuration = 60;

// The voice comes off the wire, so every field is bounded before it reaches a
// prompt. It is the reader's own writing either way, but a request is a
// request and an unbounded one is an unbounded bill.
const Line = z.string().max(400);

const Note = z.object({
  label: z.string().max(120),
  detail: z.string().max(400),
});

const Body = z.object({
  id: z.string().min(1).max(128),
  voice: z.object({
    profile: z.object({
      summary: z.array(Line).max(6),
      traits: z.array(Note).max(6),
      openings: z.array(Line).max(6),
      signoffs: z.array(Line).max(6),
      habits: z.array(Line).max(8),
      phrases: z.array(Line).max(10),
      registers: z
        .array(z.object({ audience: z.string().max(120), detail: z.string().max(400) }))
        .max(4),
      avoid: z.array(Line).max(6),
      source: z.enum(["claude", "none"]),
    }),
    medianWords: z.number().int().min(0).max(10_000),
  }),
});

export async function POST(request: NextRequest) {
  const auth = await authorizedClient();
  if (!auth) return json({ error: "Not connected." }, 401);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Bad request." }, 400);

  const { id, voice } = parsed.data;

  try {
    // The address first: it is what an invite's ATTENDEE lines are matched on.
    const account = await fetchAccountEmail(auth).catch(() => "");
    const message = await fetchMessage(auth, id, account);

    return json(await draftReply(message, plainText(message.body.blocks), voice));
  } catch (error) {
    console.error("Could not write the draft", error);
    return json(
      {
        error: error instanceof Error ? error.message : String(error),
        reconnect: isAuthError(error),
      },
      502,
    );
  }
}
