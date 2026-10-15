import { Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";
import type {
  ActivityActionItem,
  ActivitySelectionTarget,
} from "../../../src/features/activity/model/activity-action";
import {
  ActivityDefaultIntent,
  ActivityExplicitIntent,
  BorrowActivityExplicitIntent,
  findActivityActionInFeed,
  parseActivityRouteIntent,
  resolveActivityHighlightAction,
  resolveActivitySelection,
  resolveDefaultSelection,
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

// Only the tag and id take part in selection.
const borrowFeedItem = (id: string) =>
  ({
    _tag: "borrow",
    actionData: { id },
  }) as unknown as ActivityActionItem;

const yieldTarget = (actionId: string) =>
  ({ actionId, source: "yield" }) as ActivitySelectionTarget;
const borrowTarget = (actionId: string) =>
  ({ actionId, source: "borrow" }) as ActivitySelectionTarget;

const readyView = (
  actions: Array<ActivityActionItem> = [feedItem("newest-action")]
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
    expect(resolveDefaultSelection({ status: "loading" })).toBe("loading");
  });

  it("selects the first feed action", () => {
    expect(resolveDefaultSelection(readyView())).toEqual(
      yieldTarget("newest-action")
    );
  });

  it("selects a Borrow row as the default when it is first", () => {
    expect(
      resolveDefaultSelection(
        readyView([borrowFeedItem("borrow-action"), feedItem("older")])
      )
    ).toEqual(borrowTarget("borrow-action"));
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
    expect(resolveDefaultSelection(projectFeed(result))).toEqual(
      yieldTarget("newest-action")
    );
  });

  it("is unavailable when the feed is empty", () => {
    expect(resolveDefaultSelection({ status: "empty" })).toBe(null);
  });
});

describe("Activity selection from intent", () => {
  it("keeps an explicit action id without waiting on the feed", () => {
    expect(
      resolveActivitySelection(
        new ActivityExplicitIntent({ actionId: "picked-action" as never }),
        { status: "loading" }
      )
    ).toEqual(yieldTarget("picked-action"));
  });

  it("keeps an explicit Borrow action as a Borrow target", () => {
    expect(
      resolveActivitySelection(
        new BorrowActivityExplicitIntent({ actionId: "borrow-1" as never }),
        { status: "loading" }
      )
    ).toEqual(borrowTarget("borrow-1"));
  });

  it("resolves default intent from the feed", () => {
    expect(
      resolveActivitySelection(new ActivityDefaultIntent(), readyView())
    ).toEqual(yieldTarget("newest-action"));
  });

  it("hides the feed highlight while default selection is still loading", () => {
    expect(
      resolveActivityHighlightAction(new ActivityDefaultIntent(), {
        status: "loading",
      })
    ).toBe(null);
    expect(
      resolveActivityHighlightAction(new ActivityDefaultIntent(), readyView())
    ).toEqual(yieldTarget("newest-action"));
  });
});

describe("Activity feed lookup for details", () => {
  it("returns the enriched feed row when the id is present", () => {
    const item = feedItem("picked-action");
    expect(
      findActivityActionInFeed(
        yieldTarget("picked-action"),
        readyView([feedItem("other"), item])
      )
    ).toBe(item);
  });

  it("finds a row only for a target from its own source", () => {
    const borrowItem = borrowFeedItem("shared-id");
    const view = readyView([feedItem("shared-id"), borrowItem]);

    expect(findActivityActionInFeed(borrowTarget("shared-id"), view)).toBe(
      borrowItem
    );
    expect(
      findActivityActionInFeed(borrowTarget("newest-action"), readyView())
    ).toBe(null);
  });

  it("returns null when the feed is not ready or the id is missing", () => {
    expect(
      findActivityActionInFeed(yieldTarget("picked-action"), {
        status: "loading",
      })
    ).toBe(null);
    expect(
      findActivityActionInFeed(yieldTarget("missing-action"), readyView())
    ).toBe(null);
  });
});

describe("Activity route intent parsing", () => {
  it("treats a missing param as default only when allowed", () => {
    expect(
      parseActivityRouteIntent({
        actionIdParam: undefined,
        allowDefault: true,
        source: "yield",
      })
    ).toEqual({ intent: new ActivityDefaultIntent(), status: "ok" });
    expect(
      parseActivityRouteIntent({
        actionIdParam: undefined,
        allowDefault: false,
        source: "yield",
      })
    ).toEqual({ status: "missing" });
  });

  it("decodes a valid action id as explicit intent", () => {
    expect(
      parseActivityRouteIntent({
        actionIdParam: "action-1",
        allowDefault: false,
        source: "yield",
      })
    ).toEqual({
      intent: new ActivityExplicitIntent({ actionId: "action-1" as never }),
      status: "ok",
    });
  });

  it("decodes a Borrow route param as Borrow explicit intent", () => {
    expect(
      parseActivityRouteIntent({
        actionIdParam: "borrow-1",
        allowDefault: false,
        source: "borrow",
      })
    ).toEqual({
      intent: new BorrowActivityExplicitIntent({
        actionId: "borrow-1" as never,
      }),
      status: "ok",
    });
  });

  it("treats an empty action id segment as default", () => {
    expect(
      parseActivityRouteIntent({
        actionIdParam: "",
        allowDefault: true,
        source: "yield",
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
