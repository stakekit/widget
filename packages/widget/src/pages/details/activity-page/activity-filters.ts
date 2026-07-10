import type { ActivityActionsQuery } from "../../../domain/schema/legacy-models";
import {
  type DashboardYieldCategory,
  getApiYieldTypesForDashboardCategory,
} from "../../../domain/types/yields";

export type ActivityFilter = "all" | DashboardYieldCategory;

export const activityFilterCategories = [
  "stake",
  "defi",
  "rwa",
] as const satisfies ReadonlyArray<DashboardYieldCategory>;

export const getActivityFilterYieldTypes = (
  filter: ActivityFilter
): ActivityActionsQuery["yieldTypes"] =>
  filter === "all" ? undefined : getApiYieldTypesForDashboardCategory(filter);
