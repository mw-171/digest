"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { STORAGE_KEY } from "@/app/providers";

/** Empties the persisted cache. Rendered signed-out, where there is no session. */
export function ClearCache() {
  const client = useQueryClient();

  React.useEffect(() => {
    client.clear();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private mode: nothing was persisted anyway.
    }
  }, [client]);

  return null;
}
