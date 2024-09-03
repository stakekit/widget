import type { useActivityActions } from "@sk-widget/hooks/api/use-activity-actions";
import type { ActionYieldDto } from "@sk-widget/pages/details/activity-page/types";

export type ActivityPageContextType = {
  onActionSelect: (val: ActionYieldDto) => void;
  // selectedAction: ActionTypes | undefined;
  activityActions: ReturnType<typeof useActivityActions>;
};
