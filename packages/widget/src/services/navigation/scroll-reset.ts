/**
 * A window scroll reset that waits for the page a navigation leads to.
 *
 * The router hands a location to React in a transition, so the page being
 * left stays on screen for a few frames. Scrolling when the navigation starts
 * shows that page jumping to the top before the next one replaces it; the
 * reset runs when the next page commits instead.
 */
export type ScrollReset = Readonly<{
  /**
   * Resets the window's scroll once a location other than `from` commits.
   * Returns the request, which only its own navigation may cancel.
   */
  readonly request: (from: string) => ScrollResetRequest;
  /**
   * Drops `request`, whose navigation kept its location. A newer request,
   * even from the same location, stays.
   */
  readonly cancel: (request: ScrollResetRequest) => void;
  /** Reports that the page for the location `key` is committed to the DOM. */
  readonly pageCommitted: (key: string) => void;
}>;

/** One navigation's request to reset the scroll. */
export type ScrollResetRequest = Readonly<{ readonly from: string }>;

export const makeScrollReset = (): ScrollReset => {
  const pending: { request: ScrollResetRequest | null } = { request: null };
  return {
    request: (from) => {
      const request = { from };
      pending.request = request;
      return request;
    },
    cancel: (request) => {
      if (pending.request === request) pending.request = null;
    },
    pageCommitted: (key) => {
      if (pending.request === null || pending.request.from === key) return;
      pending.request = null;
      globalThis.window?.scrollTo(0, 0);
    },
  };
};
