import { NextResponse } from "next/server";

/**
 * A JSON reply that nothing is allowed to cache. Reloading the tab is this
 * app's only refresh gesture, so every digest response has to come from Gmail
 * rather than from the browser's HTTP cache or a proxy in between.
 */
export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, must-revalidate" },
  });
}
