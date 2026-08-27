import type { NextRequest } from "next/server";

import { isValidDay, toDayString } from "@/lib/day";
import { getWeek } from "@/lib/digest";
import { authorizedClient, isAuthError } from "@/lib/google";
import { json } from "@/lib/http";

/**
 * Volume counts for the seven days starting at `start`.
 * Cheap: ids only, and
 * recomputed on every request for the same reason the digest is.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // The window's first day. The rail slides independently of the selection,
  // so the client says which seven days it is showing rather than implying it.
  const start = request.nextUrl.searchParams.get("start");
  if (!start || !isValidDay(start) || start > toDayString()) {
    return json({ error: "Bad start date." }, 400);
  }

  if (!(await authorizedClient())) {
    return json({ error: "Not connected." }, 401);
  }

  try {
    return json(await getWeek(start));
  } catch (error) {
    console.error("Could not load the week", error);
    return json(
      {
        error: error instanceof Error ? error.message : String(error),
        reconnect: isAuthError(error),
      },
      502,
    );
  }
}
