import { afterEach, describe, expect, it, vi } from "vitest";

import { makeScrollReset } from "../../../src/services/navigation/scroll-reset";

describe("makeScrollReset", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a newer request when a superseded one from the same page is dropped", () => {
    const scrollToTop = vi.fn();
    vi.stubGlobal("window", { scrollTo: scrollToTop });
    const scrollReset = makeScrollReset();

    const superseded = scrollReset.request("earn");
    const replacement = scrollReset.request("earn");
    // The superseded navigation settles while the location is still "earn".
    scrollReset.cancel(superseded);
    scrollReset.pageCommitted("positions");

    expect(scrollToTop).toHaveBeenCalledTimes(1);
    scrollReset.cancel(replacement);
  });

  it("drops a request whose navigation kept its page", () => {
    const scrollToTop = vi.fn();
    vi.stubGlobal("window", { scrollTo: scrollToTop });
    const scrollReset = makeScrollReset();

    scrollReset.cancel(scrollReset.request("earn"));
    scrollReset.pageCommitted("positions");

    expect(scrollToTop).not.toHaveBeenCalled();
  });
});
