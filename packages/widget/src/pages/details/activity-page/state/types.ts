import type { useActivityActions } from "@sk-widget/hooks/api/use-activity-actions";
import type { ActionYieldDto } from "@sk-widget/pages/details/activity-page/types";

export type ActivityPageContextType = {
  onActionSelect: (val: ActionYieldDto) => void;
  activityActions: ReturnType<typeof useActivityActions>;
  labels: string[];
  counts: number[];
  bulletLines: ItemBulletType[];
};

export const ItemBulletType = {
  ALONE: "alone",
  FIRST: "first",
  MIDDLE: "middle",
  LAST: "last",
};

export type ItemBulletType =
  (typeof ItemBulletType)[keyof typeof ItemBulletType];
