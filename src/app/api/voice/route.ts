import { getVoice, SAMPLE_SIZE } from "@/lib/voice";
import { authorizedClient, isAuthError } from "@/lib/google";
import { json } from "@/lib/http";

/**
 * How you write, read off your own sent mail. Always hits Gmail so a newly
 * sent email counts; Claude's read is cached on disk by the exact set of
 * message ids, so only a mailbox that moved is paid for again.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await authorizedClient())) {
    return json({ error: "Not connected." }, 401);
  }

  try {
    return json(await getVoice(SAMPLE_SIZE));
  } catch (error) {
    console.error("Could not read the voice", error);
    return json(
      {
        error: error instanceof Error ? error.message : String(error),
        reconnect: isAuthError(error),
      },
      502,
    );
  }
}
