import { useSyncExternalStore } from "react";

type Subscribe = (onChange: () => void) => () => void;

// One subscribe function per query, so a re-render keeps its subscription.
const subscriptions = new Map<string, Subscribe>();

const subscribeTo = (query: string): Subscribe => {
  const known = subscriptions.get(query);
  if (known !== undefined) return known;
  const subscribe: Subscribe = (onChange) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  };
  subscriptions.set(query, subscribe);
  return subscribe;
};

/**
 * Whether a media query matches, kept current as it changes; `false` outside
 * a browser. For behavior only, such as whether to focus a field: styles read
 * media queries through StyleX.
 */
export const useMediaQuery = (query: string) =>
  useSyncExternalStore(
    subscribeTo(query),
    () => window.matchMedia(query).matches,
    () => false
  );

/**
 * Whether the primary pointer is coarse, such as a finger: an on-screen
 * keyboard may cover the page as a field takes focus.
 */
export const useCoarsePointer = () => useMediaQuery("(pointer: coarse)");
