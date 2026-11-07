import { useAtomValue } from "@effect/atom-react";
import { Match } from "effect";
import { useTranslation } from "react-i18next";
import { presentationClockAtom } from "../../../../../shared/effect/presentation-clock";
import {
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../../yield-summary/index";
import type { ActivityActionItem } from "../../../model/activity-action";
import { projectActivityActionListItem } from "../../../model/activity-action-list-item";
import { useActivityActionTitle } from "./use-activity-action-title";

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
  const time = projection.time
    ? Match.value(projection.time).pipe(
        Match.when({ unit: "now" }, () => t("activity.time.now")),
        Match.when({ unit: "minutes" }, ({ value }) =>
          t("activity.time.minutes_ago", { count: value })
        ),
        Match.when({ unit: "hours" }, ({ value }) =>
          t("activity.time.hours_ago", { count: value })
        ),
        Match.when({ unit: "clock" }, ({ label }) => label),
        Match.exhaustive
      )
    : "";

  return {
    ...projection,
    providersDetails,
    title,
    timestamp:
      projection.voided && time !== ""
        ? t("activity.time.ended", { time })
        : time,
    statusText: projection.statusLabel
      ? t(`activity.status.${projection.statusLabel}`)
      : null,
  };
};
