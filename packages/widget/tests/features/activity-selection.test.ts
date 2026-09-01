import { describe, expect, it } from "vitest";
import {
  ActivityDefaultIntent,
  ActivityExplicitIntent,
  findActivityActionInFeed,
  parseActivityRouteIntent,
  resolveActivityHighlightActionId,
  resolveActivitySelection,
  resolveDefaultSelectedActionId,
  resolveUnavailableActivitySelection,
} from "../../src/features/activity/state/details";
import type { ActivityPageView } from "../../src/features/activity/state/page";
import { yieldApiActionFixture } from "../fixtures";

const feedItem = (id: string) => ({
  actionData: yieldApiActionFixture({ id }),
  validatorsData: [],
  walletScope: {} as never,
  yieldData: null,
});

const readyView = (
  refreshStatus: "failed" | "fresh" | "refreshing",
  actions = [feedItem("newest-action")]
): ActivityPageView => ({
  actions,
  filterOptions: [],
  pagination: { status: "complete" },
  refreshStatus,
  selectedFilter: "all",
  showingCount: actions.length,
  status: "ready",
  total: actions.length,
});

describe("Activity default selection", () => {
  it("waits while the feed is loading or refreshing", () => {
    expect(resolveDefaultSelectedActionId({ status: "loading" })).toBe(
      "loading"
    );
    expect(resolveDefaultSelectedActionId(readyView("refreshing"))).toBe(
      "loading"
    );
    expect(resolveDefaultSelectedActionId(readyView("failed"))).toBe("loading");
  });

  it("selects the first fresh feed action", () => {
    expect(resolveDefaultSelectedActionId(readyView("fresh"))).toBe(
      "newest-action"
    );
  });

  it("is unavailable when the feed is empty", () => {
    expect(resolveDefaultSelectedActionId({ status: "empty" })).toBe(null);
  });
});

describe("Activity selection from intent", () => {
  it("keeps an explicit action id without waiting on the feed", () => {
    expect(
      resolveActivitySelection(
        new ActivityExplicitIntent({ actionId: "picked-action" as never }),
        { status: "loading" }
      )
    ).toBe("picked-action");
  });

  it("resolves default intent from the fresh feed", () => {
    expect(
      resolveActivitySelection(new ActivityDefaultIntent(), readyView("fresh"))
    ).toBe("newest-action");
  });

  it("waits on default intent while the feed is refreshing", () => {
    expect(
      resolveActivitySelection(
        new ActivityDefaultIntent(),
        readyView("refreshing")
      )
    ).toBe("loading");
  });

  it("hides the feed highlight while default selection is still loading", () => {
    expect(
      resolveActivityHighlightActionId(
        new ActivityDefaultIntent(),
        readyView("refreshing")
      )
    ).toBe(null);
    expect(
      resolveActivityHighlightActionId(
        new ActivityDefaultIntent(),
        readyView("fresh")
      )
    ).toBe("newest-action");
  });
});

describe("Activity feed lookup for details", () => {
  it("returns the enriched feed row when the id is present", () => {
    const item = feedItem("picked-action");
    expect(
      findActivityActionInFeed(
        "picked-action" as never,
        readyView("fresh", [feedItem("other"), item])
      )
    ).toBe(item);
  });

  it("returns null when the feed is not ready or the id is missing", () => {
    expect(
      findActivityActionInFeed("picked-action" as never, { status: "loading" })
    ).toBe(null);
    expect(
      findActivityActionInFeed("missing-action" as never, readyView("fresh"))
    ).toBe(null);
  });

  it("still finds a row while the feed is refreshing", () => {
    const item = feedItem("picked-action");
    expect(
      findActivityActionInFeed(
        "picked-action" as never,
        readyView("refreshing", [item])
      )
    ).toBe(item);
  });
});

describe("Activity route intent parsing", () => {
  it("treats a missing param as default only when allowed", () => {
    expect(
      parseActivityRouteIntent({
        actionIdParam: undefined,
        allowDefault: true,
      })
    ).toEqual({ intent: new ActivityDefaultIntent(), status: "ok" });
    expect(
      parseActivityRouteIntent({
        actionIdParam: undefined,
        allowDefault: false,
      })
    ).toEqual({ status: "missing" });
  });

  it("decodes a valid action id as explicit intent", () => {
    expect(
      parseActivityRouteIntent({
        actionIdParam: "action-1",
        allowDefault: false,
      })
    ).toEqual({
      intent: new ActivityExplicitIntent({ actionId: "action-1" as never }),
      status: "ok",
    });
  });

  it("rejects an empty action id segment", () => {
    expect(
      parseActivityRouteIntent({
        actionIdParam: "",
        allowDefault: true,
      })
    ).toEqual({ intent: new ActivityDefaultIntent(), status: "ok" });
  });
});

describe("Unavailable activity selection", () => {
  it("clears an explicit action route that is stale for the current wallet", () => {
    expect(
      resolveUnavailableActivitySelection(
        new ActivityExplicitIntent({ actionId: "stale-action" as never })
      )
    ).toBe("clear-route");
  });

  it("leaves the details pane empty when default selection has nothing", () => {
    expect(
      resolveUnavailableActivitySelection(new ActivityDefaultIntent())
    ).toBe("empty");
  });
});
