"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { STORAGE_KEY } from "@/app/providers";

/**
 * Empties the persisted digest cache, from the signed-out screen — the one
 * place we know there is no session. Subject lines and sender names should not
 * outlive the connection they came from.
 */
export function ClearCache() {
  const client = useQueryClient();

  React.useEffect(() => {
    client.clear();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private mode, or storage disabled. Nothing was persisted either way.
    }
  }, [client]);

  return null;
}
