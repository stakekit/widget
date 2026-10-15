import { useAtomValue } from "@effect/atom-react";
import { Match } from "effect";
import { useTranslation } from "react-i18next";
import { presentationClockAtom } from "../../../../../shared/effect/presentation-clock";
import {
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../../yield-summary/index";
import type { ActivityActionItem } from "../../../model/activity-action";
import {
  type ActivityDirection,
  projectActivityActionListItem,
} from "../../../model/activity-action-list-item";
import type { ActivityIconType } from "../components/activity-icon";
import { useActivityActionTitle } from "./use-activity-action-title";

const ICON_TYPE_MAP: Record<ActivityDirection, ActivityIconType> = {
  deposit: "in",
  neutral: "neutral",
  rewards: "rewards",
  withdraw: "out",
};

export const useActionListItem = (action: ActivityActionItem) => {
  const { t, i18n } = useTranslation();
  const presentationTime = useAtomValue(presentationClockAtom);
  const locale = i18n.language;
  const yieldItem = action._tag === "yield" ? action : null;
  const providersDetails = useAtomValue(
    yieldSummaryAtom(
      new YieldSummaryKey({
        yield: yieldItem?.yieldData ?? null,
        validators: yieldItem?.validatorsData ?? [],
      })
    )
  ).providers;
  const projection = projectActivityActionListItem({
    action,
    locale,
    presentationTime,
  });
  const title = useActivityActionTitle(projection.title);
  const timestamp = projection.timestamp;
  const timestampAbsolute = timestamp
    ? Match.value(timestamp.dayKind).pipe(
        Match.when(
          "today",
          () => `${t("activity.date_group_labels.today")} · ${timestamp.time}`
        ),
        Match.when("yesterday", () =>
          t("activity.date_group_labels.yesterday")
        ),
        Match.when("other", () => timestamp.date),
        Match.exhaustive
      )
    : "";
  const timestampRelative = timestamp
    ? Match.value(timestamp.relative).pipe(
        Match.when({ unit: "now" }, () => t("activity.time.now")),
        Match.when({ unit: "minutes" }, ({ value }) =>
          t("activity.time.minutes_ago", { count: value })
        ),
        Match.when({ unit: "hours" }, ({ value }) =>
          t("activity.time.hours_ago", { count: value })
        ),
        Match.when({ unit: "days" }, ({ value }) =>
          t("activity.time.days_ago", { count: value })
        ),
        Match.exhaustive
      )
    : "";

  return {
    ...projection,
    providersDetails,
    iconType: ICON_TYPE_MAP[projection.direction],
    title,
    timestampAbsolute,
    timestampRelative,
    badgeLabel: projection.statusLabel
      ? t(`activity.status.${projection.statusLabel}`)
      : null,
  };
};
