import type { ActivityActionsQuery } from "../../../domain/schema/legacy-models";
import { getApiYieldTypesForDashboardCategory } from "../../../domain/types/yields";
import type { DashboardYieldCategory } from "../../../public-api/types";

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
