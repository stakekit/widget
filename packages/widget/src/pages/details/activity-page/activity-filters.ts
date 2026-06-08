import {
  type DashboardYieldCategory,
  getDashboardYieldCategory,
} from "../../../domain/types/yields";
import type { ActionYieldDto } from "./types";

export type ActivityFilterCategory = DashboardYieldCategory | "borrow";

export type ActivityFilter = "all" | ActivityFilterCategory;

/**
 * Order in which the filter pills are rendered. "borrow" has no client-side
 * signal yet and will only start matching once the API exposes a category per
 * action; until then its pill stays hidden because no items resolve to it.
 */
export const activityFilterCategories = [
  "stake",
  "defi",
  "rwa",
  "borrow",
] as const satisfies ReadonlyArray<ActivityFilterCategory>;

export const getActivityFilterCategory = (
  action: ActionYieldDto
): ActivityFilterCategory | null => getDashboardYieldCategory(action.yieldData);
