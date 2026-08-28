"use client";

import * as React from "react";

/** Long enough for a layer to fade out before it is taken off the page. */
export const FADE_MS = 500;

/** A fetch answered inside this never earns an indicator. */
export const SHOW_DELAY_MS = 200;

/** `on`, held for `ms` after it goes false — long enough to fade out. */
export function useLingering(on: boolean, ms: number) {
  const [alive, setAlive] = React.useState(on);

  React.useEffect(() => {
    if (on) {
      setAlive(true);
      return;
    }
    const timer = setTimeout(() => setAlive(false), ms);
    return () => clearTimeout(timer);
  }, [on, ms]);

  return alive;
}

/** `on`, but only once it has been true for `ms`. */
export function useDelayed(on: boolean, ms: number) {
  const [late, setLate] = React.useState(false);

  React.useEffect(() => {
    if (!on) {
      setLate(false);
      return;
    }
    const timer = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(timer);
  }, [on, ms]);

  return late;
}

/**
 * False until React has hydrated. The persisted cache can restore before React
 * reaches a subtree, and rendering that data on the first pass makes the client
 * disagree with the server's HTML — React then rebuilds the whole tree.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  return hydrated;
}
