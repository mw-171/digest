import { NextResponse, type NextRequest } from "next/server";
import { TOKEN_COOKIE } from "@/lib/google";

/** Forget the refresh token. Does not revoke the grant on Google's side. */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(TOKEN_COOKIE);
  return response;
}
