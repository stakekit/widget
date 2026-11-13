/**
 * A window scroll reset that waits for the page a navigation leads to.
 *
 * The router hands a location to React in a transition, so the page being
 * left stays on screen for a few frames. Scrolling when the navigation starts
 * shows that page jumping to the top before the next one replaces it; the
 * reset runs when the next page commits instead.
 */
export type ScrollReset = Readonly<{
  /** Resets the window's scroll once a location other than `from` commits. */
  readonly request: (from: string) => void;
  /** Drops the request made from `from`: its navigation kept that location. */
  readonly cancel: (from: string) => void;
  /** Reports that the page for the location `key` is committed to the DOM. */
  readonly pageCommitted: (key: string) => void;
}>;

export const makeScrollReset = (): ScrollReset => {
  const pending: { from: string | null } = { from: null };
  return {
    request: (from) => {
      pending.from = from;
    },
    cancel: (from) => {
      if (pending.from === from) pending.from = null;
    },
    pageCommitted: (key) => {
      if (pending.from === null || pending.from === key) return;
      pending.from = null;
      globalThis.window?.scrollTo(0, 0);
    },
  };
};
