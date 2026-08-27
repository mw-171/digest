"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import {
  PersistQueryClientProvider,
  removeOldestQuery,
} from "@tanstack/react-query-persist-client";
import * as React from "react";

import { CACHE_MAX_AGE, CACHE_VERSION } from "@/lib/digest-query";

/** Where the dehydrated cache lives. Cleared when the session ends. */
export const STORAGE_KEY = "digest-cache";

/**
 * One query cache for the session, persisted to localStorage, so paging
 * between days and reloading both reuse what has already been triaged.
 * `gcTime` must outlive `CACHE_MAX_AGE` or entries are dropped from memory
 * before there is anything worth restoring.
 */
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

  // On the server there is no localStorage, and a persister built without one
  // is a no-op — which is exactly right for a render that has nothing to
  // restore and nothing to save.
  const [persister] = React.useState(() =>
    createSyncStoragePersister({
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      key: STORAGE_KEY,
      // A full quota is not worth failing over: drop the oldest days and try
      // again. Whatever is lost costs one refetch.
      retry: removeOldestQuery,
    }),
  );

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        // A shape change invalidates everything stored under the old version.
        buster: CACHE_VERSION,
        dehydrateOptions: {
          // Never store a failure: a 401 from an expired token would come back
          // on the next load and read as a fresh one.
          shouldDehydrateQuery: (query) => query.state.status === "success",
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
