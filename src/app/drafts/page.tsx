import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DraftsClient } from "@/app/component/drafts/drafts-client";
import { authorizedClient, isConfigured } from "@/lib/google";

export const metadata: Metadata = { title: "Drafts" };

export default async function DraftsPage() {
  // Auth is the one thing the server still decides — it owns the cookie, and
  // connecting is something only the digest screen offers.
  if (!isConfigured() || !(await authorizedClient())) redirect("/");

  return <DraftsClient />;
}
