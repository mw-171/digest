import { createHash } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { readCache, writeCache } from "@/lib/ai-cache";
import type { FullMessage } from "@/lib/gmail";

/**
 * One email, read for you.
 *
 * The detail view deliberately does not re-render the sender's HTML — see
 * `email-body.ts` for why that never ends well. Instead Claude reads the
 * message and says what it is, what it says, and whether anything is being
 * asked of the reader. The original is always one tap away in Gmail.
 */
const SummarySchema = z.object({
  summary: z
    .string()
    .describe(
      "What this email says, in two or three plain sentences, written to the reader as 'you'. No greeting and no preamble like 'This email is'.",
    ),
  points: z
    .array(z.string())
    .describe(
      "Up to four short lines carrying the concrete details the reader would otherwise have to hunt for: amounts, dates, names, links, order numbers. Fewer is better, and an empty list is fine when the summary already covers it. No trailing periods.",
    ),
  action: z
    .string()
    .describe(
      "What the reader has to do, at most eight words, e.g. \"Approve the invoice by 3 September\". Empty string when the email asks nothing of them.",
    ),
});

export type MessageSummary = z.infer<typeof SummarySchema> & {
  source: "claude" | "none";
};

const MODEL = "claude-opus-5";
// Bump when the prompt or the schema changes so old entries are ignored.
const PROMPT_VERSION = 1;

const SYSTEM = `You explain one email to the person who received it.

Write for someone deciding whether this needs them right now. Lead with what
happened or what is being asked, never with what kind of email it is. Plain
declarative sentences, no marketing tone, no hedging, and never invent a detail
the email does not contain.

Keep the reader's own facts in: amounts, dates, times, names, order and flight
numbers, deadlines. Drop the sender's boilerplate — unsubscribe lines, legal
footers, "view in browser", social icons, repeated calls to action.

If the email is a person writing to the reader, say what they said and what
they want back. If it is automated, say what happened and whether anything is
required. Lines marked with ">" are the earlier message being replied to —
read them for context, but summarise the new message, not the thread.

Set "action" only when the reader has to do something. Otherwise use "".`;

const MAX_BODY = 12_000;

function cacheKey(id: string, body: string) {
  const digest = createHash("sha1")
    .update(`${PROMPT_VERSION}:${MODEL}:${body}`)
    .digest("hex")
    .slice(0, 16);
  return `message-${id}-${digest}.json`;
}

/**
 * Claude's read of one message. Cached on disk against the message id and the
 * body it was computed from, so reopening an email is free and instant.
 * Returns `source: "none"` when there is no API key or the call fails — the
 * page then falls back to the message's own text.
 */
export async function summarizeMessage(
  message: FullMessage,
  bodyText: string,
): Promise<MessageSummary> {
  const body = bodyText.slice(0, MAX_BODY).trim() || message.snippet;
  const empty: MessageSummary = {
    summary: "",
    points: [],
    action: "",
    source: "none",
  };
  if (!body) return empty;

  const key = cacheKey(message.id, body);
  const cached = await readCache<z.infer<typeof SummarySchema>>(key);
  if (cached) return { ...cached, source: "claude" };

  if (!process.env.ANTHROPIC_API_KEY) return empty;

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      // One short email, one short answer: low effort keeps the page fast.
      output_config: { effort: "low", format: zodOutputFormat(SummarySchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            `From: ${message.from} <${message.fromEmail}>`,
            `Subject: ${message.subject}`,
            `Received: ${message.receivedAt}`,
            "",
            body,
          ].join("\n"),
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.warn("Claude did not summarise the message", response.stop_reason);
      return empty;
    }

    const value = {
      summary: response.parsed_output.summary.trim(),
      points: response.parsed_output.points
        .map((point) => point.trim().replace(/\.$/, ""))
        .filter(Boolean)
        .slice(0, 4),
      action: response.parsed_output.action.trim(),
    };

    await writeCache(key, value);
    return { ...value, source: "claude" };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.warn("ANTHROPIC_API_KEY rejected; showing the message as-is");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.warn("Rate limited by the Claude API; showing the message as-is");
    } else {
      console.error("Could not summarise the message", error);
    }
    return empty;
  }
}
