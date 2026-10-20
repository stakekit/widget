import { Match } from "effect";
import { useTranslation } from "react-i18next";
import type { ActivityActionTitle } from "../../../model/activity-action-list-item";

export const useActivityActionTitle = (title: ActivityActionTitle) => {
  const { t } = useTranslation();

  if (title._tag === "borrow") {
    const { action, tokenSymbol } = title;
    return tokenSymbol
      ? t(`activity.item.borrow.${action}`, { token: tokenSymbol })
      : t(`activity.item.borrow.${action}_without_token`);
  }

  return Match.value(title).pipe(
    Match.when({ _tag: "deposited" }, ({ tokenSymbol }) =>
      tokenSymbol
        ? t("activity.item.deposited", { token: tokenSymbol })
        : t("activity.item.deposited_without_token")
    ),
    Match.when({ _tag: "deposit_submitted" }, ({ tokenSymbol }) =>
      tokenSymbol
        ? t("activity.item.deposit_submitted", { token: tokenSymbol })
        : t("activity.item.deposit_submitted_without_token")
    ),
    Match.when({ _tag: "withdrew" }, ({ tokenSymbol }) =>
      tokenSymbol
        ? t("activity.item.withdrew", { token: tokenSymbol })
        : t("activity.item.withdrew_without_token")
    ),
    Match.when({ _tag: "rewards" }, () => t("activity.item.rewards")),
    Match.when({ _tag: "generic" }, ({ actionLabel, tokenSymbol }) =>
      tokenSymbol
        ? t("activity.item.generic", {
            action: actionLabel,
            token: tokenSymbol,
          })
        : t("activity.item.generic_without_token", { action: actionLabel })
    ),
    Match.exhaustive
  );
};
