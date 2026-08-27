"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import {
  PersistQueryClientProvider,
  removeOldestQuery,
} from "@tanstack/react-query-persist-client";
import * as React from "react";

import { CACHE_MAX_AGE, CACHE_VERSION } from "@/lib/digest-query";

export const STORAGE_KEY = "digest-cache";

// One query cache for the session, persisted to localStorage. `gcTime` must
// outlive `CACHE_MAX_AGE`, or entries are dropped before they can be restored.
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: CACHE_MAX_AGE,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const [persister] = React.useState(() =>
    createSyncStoragePersister({
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      key: STORAGE_KEY,
      // A full quota costs one refetch, not a failure.
      retry: removeOldestQuery,
    }),
  );

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        buster: CACHE_VERSION,
        dehydrateOptions: {
          // Never store a failure: a stale 401 would read as a fresh one.
          shouldDehydrateQuery: (query) => query.state.status === "success",
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
