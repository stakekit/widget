import { Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
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
} from "../../../src/features/activity/state/details";
import {
  type ActivityPageView,
  projectActivityPageView,
} from "../../../src/features/activity/state/page";
import { yieldApiActionFixture } from "../../fixtures";

type ActivityActionsResult = Parameters<
  typeof projectActivityPageView
>[0]["actionsResult"];

const feedItem = (id: string) => ({
  _tag: "yield" as const,
  actionData: yieldApiActionFixture({ id }),
  validatorsData: [],
  walletScope: {} as never,
  yieldData: null,
});

const readyView = (
  actions = [feedItem("newest-action")]
): ActivityPageView => ({
  actions,
  filterOptions: [],
  pagination: { status: "complete" },
  selectedFilter: "all",
  showingCount: actions.length,
  status: "ready",
  total: actions.length,
});

const feedPage = AsyncResult.success({
  done: false,
  items: [
    { actions: [feedItem("newest-action")], hasNextPage: true, total: 2 },
  ],
}) as ActivityActionsResult;

const projectFeed = (actionsResult: ActivityActionsResult) =>
  projectActivityPageView({
    actionsResult,
    filterOptionsResult: AsyncResult.success([]),
    selectedFilter: "all",
    walletStatus: "connected",
  });

describe("Activity default selection", () => {
  it("waits while the feed has no rows yet", () => {
    expect(resolveDefaultSelectedActionId({ status: "loading" })).toBe(
      "loading"
    );
  });

  it("selects the first feed action", () => {
    expect(resolveDefaultSelectedActionId(readyView())).toBe("newest-action");
  });

  it.each([
    ["revalidates", AsyncResult.waiting(feedPage)],
    [
      "fails to refresh",
      AsyncResult.failureWithPrevious(Cause.fail(undefined as never), {
        previous: Option.some(feedPage),
      }),
    ],
  ])("keeps the first feed action while the feed %s", (_, result) => {
    expect(resolveDefaultSelectedActionId(projectFeed(result))).toBe(
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

  it("resolves default intent from the feed", () => {
    expect(
      resolveActivitySelection(new ActivityDefaultIntent(), readyView())
    ).toBe("newest-action");
  });

  it("hides the feed highlight while default selection is still loading", () => {
    expect(
      resolveActivityHighlightActionId(new ActivityDefaultIntent(), {
        status: "loading",
      })
    ).toBe(null);
    expect(
      resolveActivityHighlightActionId(new ActivityDefaultIntent(), readyView())
    ).toBe("newest-action");
  });
});

describe("Activity feed lookup for details", () => {
  it("returns the enriched feed row when the id is present", () => {
    const item = feedItem("picked-action");
    expect(
      findActivityActionInFeed(
        "picked-action" as never,
        readyView([feedItem("other"), item])
      )
    ).toBe(item);
  });

  it("returns null when the feed is not ready or the id is missing", () => {
    expect(
      findActivityActionInFeed("picked-action" as never, { status: "loading" })
    ).toBe(null);
    expect(
      findActivityActionInFeed("missing-action" as never, readyView())
    ).toBe(null);
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
