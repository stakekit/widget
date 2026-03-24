import type { TFunction } from "i18next";
import type { ActionDto } from "../../../domain/types/action";
import type { Yield } from "../../../domain/types/yields";

export type ActionYieldDto = {
  actionData: ActionDto;
  yieldData: Yield;
};

type DateGroupLabels = "today" | "yesterday" | string;

export const dateGroupLabels = (label: DateGroupLabels, t: TFunction) => {
  if (label === "today") return t("activity.date_group_labels.today");
  if (label === "yesterday") return t("activity.date_group_labels.yesterday");
  return label;
};
