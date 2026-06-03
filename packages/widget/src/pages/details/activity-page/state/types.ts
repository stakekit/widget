import type { useActivityActions } from "../../../../hooks/api/use-activity-actions";
import type { ActionYieldDto } from "../types";

export type ActivityPageContextType = {
  onActionSelect: (val: ActionYieldDto) => void;
  activityActions: ReturnType<typeof useActivityActions>;
};
