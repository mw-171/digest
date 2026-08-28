import { createHash } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { readCache, writeCache } from "@/lib/ai-cache";
import type { SentMessage } from "@/lib/gmail";

/**
 * Your voice, read off your own sent mail. Nothing here describes the people
 * you wrote to or what the mail was about — it is a description of the writing,
 * kept so a draft can later be written in it rather than in a model's default
 * register.
 */
const VoiceSchema = z.object({
  summary: z
    .array(z.string())
    .describe(
      "Three or four lines on how this person writes email, most distinctive first. One plain sentence each, at most eighteen words, addressed to them as 'you'. Each line stands alone and says a different thing. No preamble like 'This writer' and no trailing periods.",
    ),
  traits: z
    .array(
      z.object({
        label: z
          .string()
          .describe("The trait in at most four words, e.g. 'Short and front-loaded'."),
        detail: z
          .string()
          .describe(
            "One sentence, at most twenty words, on how it shows up in the writing. Written to them as 'you'.",
          ),
      }),
    )
    .describe("Between three and five traits, most distinctive first."),
  openings: z
    .array(z.string())
    .describe(
      "The greetings they actually use, copied verbatim, most frequent first. At most five. Empty when they open cold with no greeting.",
    ),
  signoffs: z
    .array(z.string())
    .describe(
      "The sign-offs they actually use, copied verbatim, most frequent first. At most five.",
    ),
  habits: z
    .array(z.string())
    .describe(
      "Up to six short lines on the mechanics: sentence and paragraph length, punctuation, capitalisation, contractions, emoji, exclamation marks, lists, links. Concrete and observed, never generic advice. No trailing periods.",
    ),
  phrases: z
    .array(z.string())
    .describe(
      "Up to eight words or phrases they reach for again and again, copied verbatim. Skip anything that is just ordinary English.",
    ),
  registers: z
    .array(
      z.object({
        audience: z
          .string()
          .describe("Who or what the register is for, at most four words, e.g. 'Close colleagues'."),
        detail: z
          .string()
          .describe("One sentence, at most twenty words, on how the voice shifts there."),
      }),
    )
    .describe(
      "Up to three ways the voice changes with the audience. Empty when it does not visibly change.",
    ),
  avoid: z
    .array(z.string())
    .describe(
      "Up to five things that never appear in their writing and would give a draft away as not theirs. Concrete, e.g. 'Never opens with I hope this finds you well'. No trailing periods.",
    ),
});

export type VoiceTrait = { label: string; detail: string };
export type VoiceRegister = { audience: string; detail: string };

export type VoiceProfile = z.infer<typeof VoiceSchema> & {
  /** "none" when Claude could not be reached, so the page can say so. */
  source: "claude" | "none";
};

export const EMPTY_PROFILE: VoiceProfile = {
  summary: [],
  traits: [],
  openings: [],
  signoffs: [],
  habits: [],
  phrases: [],
  registers: [],
  avoid: [],
  source: "none",
};

const MODEL = "claude-opus-5";
// Bump when the prompt or the schema changes so old entries are ignored.
const PROMPT_VERSION = 2;

const SYSTEM = `You read a person's own sent email and describe how they write.

Everything you return is about the writing, never about the people they wrote
to and never about what the mail was about. Do not summarise the emails and do
not repeat anything private from them.

Write to the person as "you". Be specific and observational. Every line must be
something you can point at in the sample: "you open most replies with the
answer and put the context underneath" is useful, "you write clearly" is not.
Never flatter and never give advice.

Copy openings, sign-offs and phrases verbatim, including their capitalisation
and punctuation. If they write "thanks!" rather than "Thanks!", say so — the
difference is the whole point. Order them by how often they appear.

The summary is the first thing they read and the only part that is not a
list of examples, so make each of its lines carry a different observation:
the shape of their emails, their register, their length, the one habit a
stranger would notice first. Never repeat what the openings and sign-offs
already show.

Note what is absent as well as what is there: no greeting, no sign-off, no
exclamation marks, never a bulleted list. Absences are what most often give a
generated draft away.

Some of the sample is replies and some starts a thread, some goes to one person
and some to a group. Where the voice visibly shifts between them, say so in
"registers". Where it does not, return an empty list rather than inventing a
distinction.

The sample is only what they typed: quoted threads and signatures were removed
before you saw it. Base everything on it, and if it is thin say what it shows
rather than filling the gaps with a plausible writer.`;

const sha = (input: string) =>
  createHash("sha1").update(input).digest("hex").slice(0, 16);

/**
 * Keyed on the exact messages read, so a new sent email re-reads the voice and
 * an unchanged mailbox never pays twice.
 */
function cacheKey(messages: SentMessage[]) {
  const ids = messages.map((message) => message.id).sort().join(",");
  return `voice-${sha(`${PROMPT_VERSION}:${MODEL}:${ids}`)}.json`;
}

/** Trim the trailing period the schema asks for and drop anything empty. */
const tidyList = (lines: string[], max: number) =>
  lines
    .map((line) => line.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .slice(0, max);

export async function analyzeVoice(
  messages: SentMessage[],
): Promise<VoiceProfile> {
  if (messages.length === 0) return EMPTY_PROFILE;

  const key = cacheKey(messages);
  const cached = await readCache<z.infer<typeof VoiceSchema>>(key);
  if (cached) return { ...cached, source: "claude" };

  if (!process.env.ANTHROPIC_API_KEY) return EMPTY_PROFILE;

  // Addresses are left out on purpose: the model is told who a message went to
  // only as much as it needs to hear a register change.
  const payload = messages.map((message) => ({
    subject: message.subject,
    sentOn: message.sentAt.slice(0, 10),
    reply: message.isReply,
    audience: message.recipients > 1 ? `${message.recipients} people` : "one person",
    body: message.text,
  }));

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(VoiceSchema),
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            `Here are ${payload.length} emails I sent, newest first. Describe how I write.`,
            JSON.stringify(payload, null, 1),
          ].join("\n\n"),
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.warn("Claude did not read the voice", response.stop_reason);
      return EMPTY_PROFILE;
    }

    const parsed = response.parsed_output;
    const value: z.infer<typeof VoiceSchema> = {
      summary: tidyList(parsed.summary, 4),
      traits: parsed.traits
        .map((trait) => ({
          label: trait.label.trim().replace(/\.$/, ""),
          detail: trait.detail.trim(),
        }))
        .filter((trait) => trait.label && trait.detail)
        .slice(0, 5),
      openings: tidyList(parsed.openings, 5),
      signoffs: tidyList(parsed.signoffs, 5),
      habits: tidyList(parsed.habits, 6),
      phrases: tidyList(parsed.phrases, 8),
      registers: parsed.registers
        .map((register) => ({
          audience: register.audience.trim().replace(/\.$/, ""),
          detail: register.detail.trim(),
        }))
        .filter((register) => register.audience && register.detail)
        .slice(0, 3),
      avoid: tidyList(parsed.avoid, 5),
    };

    await writeCache(key, value);
    return { ...value, source: "claude" };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.warn("ANTHROPIC_API_KEY rejected; the voice is unread");
    } else if (/credit balance/i.test((error as Error)?.message ?? "")) {
      // Arrives as a plain 400, so it needs matching on the message.
      console.warn("Anthropic credit balance exhausted; the voice is unread");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.warn("Rate limited by the Claude API; the voice is unread");
    } else {
      console.error("Could not read the voice", error);
    }
    return EMPTY_PROFILE;
  }
}
