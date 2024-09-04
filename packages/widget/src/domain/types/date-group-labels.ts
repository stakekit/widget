import type { TFunction } from "i18next";

export type DateGroupLabels = "today" | "yesterday" | string;

export const dateGroupLabels = (label: DateGroupLabels, t: TFunction) => {
  if (label === "today") return t("activity.date_group_labels.today");
  if (label === "yesterday") return t("activity.date_group_labels.yesterday");
  return label;
};
