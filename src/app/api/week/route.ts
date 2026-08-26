import type { NextRequest } from "next/server";

import { isValidDay, toDayString } from "@/lib/day";
import { getWeek } from "@/lib/digest";
import { authorizedClient, isAuthError } from "@/lib/google";
import { json } from "@/lib/http";

/**
 * Volume counts for the seven-day window around `date`. Cheap: ids only, and
 * recomputed on every request for the same reason the digest is.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? toDayString();
  const includeBulk = request.nextUrl.searchParams.get("bulk") === "1";
  if (!isValidDay(date) || date > toDayString()) {
    return json({ error: "Bad date." }, 400);
  }

  if (!(await authorizedClient())) {
    return json({ error: "Not connected." }, 401);
  }

  try {
    return json(await getWeek(date, includeBulk));
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
