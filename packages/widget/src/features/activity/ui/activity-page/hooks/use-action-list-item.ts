import { useAtomValue } from "@effect/atom-react";
import { Match } from "effect";
import { useTranslation } from "react-i18next";
import { presentationClockAtom } from "../../../../../shared/effect/presentation-clock";
import {
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../../yield-summary/state";
import type { ActivityActionItem } from "../../../model/activity-action";
import {
  type ActivityDirection,
  projectActivityActionListItem,
} from "../../../model/activity-action-list-item";
import type { ActivityIconType } from "../components/activity-icon";

const ICON_TYPE_MAP: Record<ActivityDirection, ActivityIconType> = {
  deposit: "in",
  rewards: "rewards",
  withdraw: "out",
  other: "in",
};

export const useActionListItem = (action: ActivityActionItem) => {
  const { t, i18n } = useTranslation();
  const presentationTime = useAtomValue(presentationClockAtom);
  const locale = i18n.language;
  const providersDetails = useAtomValue(
    yieldSummaryAtom(
      new YieldSummaryKey({
        yield: action.yieldData,
        validators: action.validatorsData,
        selectedProviderYieldId: null,
      })
    )
  ).providers;
  const projection = projectActivityActionListItem({
    action,
    locale,
    presentationTime,
    unknownTokenLabel: t("activity.item.unknown_token"),
  });
  const title = Match.value(projection.title).pipe(
    Match.when({ _tag: "deposited" }, ({ tokenSymbol }) =>
      t("activity.item.deposited", { token: tokenSymbol })
    ),
    Match.when({ _tag: "withdrew" }, ({ tokenSymbol }) =>
      t("activity.item.withdrew", { token: tokenSymbol })
    ),
    Match.when({ _tag: "rewards" }, () => t("activity.item.rewards")),
    Match.when({ _tag: "generic" }, ({ actionLabel, tokenSymbol }) =>
      t("activity.item.generic", {
        action: actionLabel,
        token: tokenSymbol,
      })
    ),
    Match.exhaustive
  );
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
    badgeLabel: t("activity.failed"),
    unavailableYieldLabel: t("activity.item.yield_unavailable"),
  };
};
