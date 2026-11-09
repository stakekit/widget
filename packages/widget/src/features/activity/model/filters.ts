import type { ActivityActionsQuery } from "../../../domain/activity/query";
import type { YieldCategory } from "../../../domain/earn/contract";
import {
  getApiYieldTypesForYieldCategory,
  getYieldCategory,
} from "../../../domain/earn/yield";
import type { ActivityActionItem } from "./activity-action";

export type ActivityFilterCategory = YieldCategory | "borrow";

/** A filter the API reads as a feed of its own. */
export type ActivityFeedFilter = "all" | ActivityFilterCategory;

/**
 * `other` holds what no category counts: Yield actions whose yield is gone or
 * has no category. The API cannot query them, so it reads the All feed.
 */
export type ActivityFilter = ActivityFeedFilter | "other";

export type ActivityFilterOption = {
  readonly count: number;
  readonly filter: ActivityFilter;
};

export const activityFilterCategories = [
  "stake",
  "defi",
  "rwa",
  "borrow",
] as const satisfies ReadonlyArray<ActivityFilterCategory>;

/** The feed a filter shows its actions from. */
export const getActivityFeedFilter = (
  filter: ActivityFilter
): ActivityFeedFilter => (filter === "other" ? "all" : filter);

/** Whether no category counts an action, so the Other filter shows it. */
export const isUncategorizedActivityAction = (
  item: ActivityActionItem
): boolean =>
  item._tag === "yield" &&
  (item.yieldData === null || getYieldCategory(item.yieldData) === null);

/**
 * The chips: All, then each category with actions, then Other with what the
 * categories leave of All, so the counts add up. With no category to tell
 * apart, there is nothing to filter and no chip shows.
 */
export const projectActivityFilterOptions = ({
  allCount,
  categoryCounts,
}: {
  readonly allCount: number;
  readonly categoryCounts: ReadonlyArray<{
    readonly count: number;
    readonly filter: ActivityFilterCategory;
  }>;
}): ReadonlyArray<ActivityFilterOption> => {
  const visible = categoryCounts.filter((option) => option.count > 0);
  if (allCount <= 0 || visible.length === 0) return [];

  const otherCount =
    allCount - visible.reduce((sum, option) => sum + option.count, 0);

  return [
    { count: allCount, filter: "all" },
    ...visible,
    ...(otherCount > 0
      ? [{ count: otherCount, filter: "other" as const }]
      : []),
  ];
};

/** Which Activity sources a feed reads; Borrow is read only when enabled. */
export type ActivityFilterSources = {
  readonly includeBorrow: boolean;
  readonly includeYield: boolean;
  readonly yieldTypes: ActivityActionsQuery["yieldTypes"];
};

export const getActivityFilterSources = (
  filter: ActivityFeedFilter,
  borrowEnabled: boolean
): ActivityFilterSources => {
  switch (filter) {
    case "all":
      return {
        includeBorrow: borrowEnabled,
        includeYield: true,
        yieldTypes: undefined,
      };
    case "borrow":
      return {
        includeBorrow: borrowEnabled,
        includeYield: false,
        yieldTypes: undefined,
      };
    default:
      return {
        includeBorrow: false,
        includeYield: true,
        yieldTypes: getApiYieldTypesForYieldCategory(filter),
      };
  }
};
