"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { STORAGE_KEY } from "@/app/providers";

/**
 * Empties the persisted digest cache.
 *
 * Rendered on the signed-out screen, which is the one place we know for
 * certain there is no session — whether you disconnected or the refresh token
 * expired. Days of subject lines and sender names should not outlive the
 * connection they came from, sitting in localStorage for the next person to
 * open the browser.
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
