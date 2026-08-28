import type { NextRequest } from "next/server";

import { isValidDay, toDayString } from "@/lib/day";
import { isTimeZone, todayIn } from "@/lib/timezone";
import { getDay } from "@/lib/digest";
import { authorizedClient, isAuthError } from "@/lib/google";
import { json } from "@/lib/http";

/**
 * One day's messages, triaged. Always hits Gmail so a reload reflects the
 * mailbox as it is now; Claude's triage is cached on disk by the message-id
 * set and the state of those messages, so a reload re-triages only when
 * something actually moved.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // The reader's zone decides where a day starts and when "today" ends.
  const tz = params.get("tz");
  const timeZone = isTimeZone(tz) ? tz : undefined;
  const today = todayIn(timeZone);

  const date = params.get("date") ?? today;
  const useAi = params.get("ai") !== "0";
  if (!isValidDay(date) || date > today) {
    return json({ error: "Bad date." }, 400);
  }

  if (!(await authorizedClient())) {
    return json({ error: "Not connected." }, 401);
  }

  try {
    return json(await getDay(date, useAi, timeZone));
  } catch (error) {
    console.error("Could not build the digest", error);
    return json(
      {
        error: error instanceof Error ? error.message : String(error),
        reconnect: isAuthError(error),
      },
      502,
    );
  }
}
