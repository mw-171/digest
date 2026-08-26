"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

/**
 * One query cache for the whole session. It lives above the router, so paging
 * between days — or opening a message and coming back — reuses whatever has
 * already been triaged instead of asking Claude again.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A day's triage is worth keeping for the whole session.
            gcTime: 1000 * 60 * 60 * 4,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
