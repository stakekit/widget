import {
  type DashboardYieldCategory,
  getApiYieldTypesForDashboardCategory,
} from "../../../domain/types/yields";
import type { ActionsControllerGetActionsParams } from "../../../generated/api/yield";

export type ActivityFilter = "all" | DashboardYieldCategory;

export const activityFilterCategories = [
  "stake",
  "defi",
  "rwa",
] as const satisfies ReadonlyArray<DashboardYieldCategory>;

export const getActivityFilterYieldTypes = (
  filter: ActivityFilter
): ActionsControllerGetActionsParams["yieldTypes"] =>
  filter === "all" ? undefined : getApiYieldTypesForDashboardCategory(filter);
