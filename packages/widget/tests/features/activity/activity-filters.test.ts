import { describe, expect, it } from "vitest";

import type {
  ActivityActionItem,
  YieldActivityItem,
} from "../../../src/features/activity/model/activity-action";
import {
  getActivityFeedFilter,
  isUncategorizedActivityAction,
  projectActivityFilterOptions,
} from "../../../src/features/activity/model/filters";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../../fixtures";

const yieldItem = (
  yieldData: YieldActivityItem["yieldData"]
): ActivityActionItem => ({
  _tag: "yield",
  actionData: yieldApiActionFixture(),
  validatorsData: [],
  walletScope: {} as never,
  yieldData,
});

describe("Activity filter options", () => {
  it("adds Other with what the categories leave of All, so the counts add up", () => {
    expect(
      projectActivityFilterOptions({
        allCount: 71,
        categoryCounts: [
          { count: 61, filter: "stake" },
          { count: 7, filter: "defi" },
          { count: 0, filter: "rwa" },
          { count: 0, filter: "borrow" },
        ],
      })
    ).toEqual([
      { count: 71, filter: "all" },
      { count: 61, filter: "stake" },
      { count: 7, filter: "defi" },
      { count: 3, filter: "other" },
    ]);
  });

  it("adds no Other when the categories count every action", () => {
    expect(
      projectActivityFilterOptions({
        allCount: 5,
        categoryCounts: [
          { count: 3, filter: "stake" },
          { count: 2, filter: "borrow" },
        ],
      })
    ).toEqual([
      { count: 5, filter: "all" },
      { count: 3, filter: "stake" },
      { count: 2, filter: "borrow" },
    ]);
  });

  it("offers no chips with nothing to tell apart", () => {
    expect(
      projectActivityFilterOptions({
        allCount: 3,
        categoryCounts: [{ count: 0, filter: "stake" }],
      })
    ).toEqual([]);
    expect(
      projectActivityFilterOptions({
        allCount: 0,
        categoryCounts: [{ count: 2, filter: "stake" }],
      })
    ).toEqual([]);
  });

  it("reads Other from the All feed", () => {
    expect(getActivityFeedFilter("other")).toBe("all");
    expect(getActivityFeedFilter("stake")).toBe("stake");
  });

  it("counts a Yield action in Other only when its yield has no category", () => {
    expect(isUncategorizedActivityAction(yieldItem(null))).toBe(true);
    expect(
      isUncategorizedActivityAction(yieldItem(yieldApiYieldFixture()))
    ).toBe(false);
    expect(
      isUncategorizedActivityAction({
        _tag: "borrow",
      } as ActivityActionItem)
    ).toBe(false);
  });
});
