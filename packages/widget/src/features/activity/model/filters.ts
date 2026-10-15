import type { ActivityActionsQuery } from "../../../domain/activity/query";
import type { DashboardYieldCategory } from "../../../domain/earn/contract";
import { getApiYieldTypesForDashboardCategory } from "../../../domain/earn/yield";

export type ActivityFilter = "all" | DashboardYieldCategory;

export type ActivityFilterOption = {
  readonly count: number;
  readonly filter: ActivityFilter;
};

export const activityFilterCategories = [
  "stake",
  "defi",
  "rwa",
] as const satisfies ReadonlyArray<DashboardYieldCategory>;

export const getActivityFilterYieldTypes = (
  filter: ActivityFilter
): ActivityActionsQuery["yieldTypes"] =>
  filter === "all" ? undefined : getApiYieldTypesForDashboardCategory(filter);
