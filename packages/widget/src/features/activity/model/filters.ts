import type { ActivityActionsQuery } from "../../../domain/activity/query";
import type { YieldCategory } from "../../../domain/earn/contract";
import { getApiYieldTypesForYieldCategory } from "../../../domain/earn/yield";

export type ActivityFilterCategory = YieldCategory | "borrow";

export type ActivityFilter = "all" | ActivityFilterCategory;

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

/** Which Activity sources a filter reads; Borrow is read only when enabled. */
export type ActivityFilterSources = {
  readonly includeBorrow: boolean;
  readonly includeYield: boolean;
  readonly yieldTypes: ActivityActionsQuery["yieldTypes"];
};

export const getActivityFilterSources = (
  filter: ActivityFilter,
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
