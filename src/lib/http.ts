import { NextResponse } from "next/server";

/** JSON nothing may cache: a reload has to reach Gmail, not an HTTP cache. */
export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, must-revalidate" },
  });
}
