import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActionStatus,
  type ActionType,
  getActionInputToken,
} from "../../../../domain/types/action";
import { useProvidersDetails } from "../../../../hooks/use-provider-details";
import { defaultFormattedNumber } from "../../../../utils";
import {
  getActivityDayKind,
  getActivityRelativeTime,
} from "../../../../utils/date";
import { capitalizeFirstLetters } from "../../../../utils/formatters";
import type { ActivityIconType } from "../components/activity-icon";
import type { ActionYieldDto } from "../types";

type ActivityDirection = "deposit" | "withdraw" | "rewards" | "other";

const DEPOSIT_ACTIONS = new Set<ActionType>([
  "STAKE",
  "STAKE_LOCKED",
  "RESTAKE",
  "REBOND",
]);

const WITHDRAW_ACTIONS = new Set<ActionType>([
  "UNSTAKE",
  "WITHDRAW",
  "WITHDRAW_ALL",
  "CLAIM_UNSTAKED",
  "UNLOCK_LOCKED",
]);

const REWARD_ACTIONS = new Set<ActionType>([
  "CLAIM_REWARDS",
  "RESTAKE_REWARDS",
  "AUTO_SWEEP_UNSTAKE_REWARDS",
  "AUTO_SWEEP_WITHDRAW_REWARDS",
]);

const getDirection = (type: ActionType): ActivityDirection => {
  if (DEPOSIT_ACTIONS.has(type)) return "deposit";
  if (WITHDRAW_ACTIONS.has(type)) return "withdraw";
  if (REWARD_ACTIONS.has(type)) return "rewards";
  return "other";
};

const ICON_TYPE_MAP: Record<ActivityDirection, ActivityIconType> = {
  deposit: "in",
  rewards: "rewards",
  withdraw: "out",
  other: "in",
};

export const useActionListItem = (action: ActionYieldDto) => {
  const { t, i18n } = useTranslation();

  const locale = i18n.language;

  const integrationData = useMemo(
    () => Maybe.fromNullable(action.yieldData),
    [action.yieldData]
  );

  const providersDetails = useProvidersDetails({
    integrationData,
    validators: Maybe.of(action.validatorsData),
    selectedProviderYieldId: Maybe.empty(),
  });

  const direction = useMemo(
    () => getDirection(action.actionData.type),
    [action.actionData.type]
  );

  const iconType = ICON_TYPE_MAP[direction];

  /** Deposits/rewards show the underlying input token, withdrawals the vault token. */
  const tokenSymbol = useMemo(() => {
    const yieldToken = action.yieldData.token;

    if (direction === "withdraw" || direction === "other") {
      return yieldToken.symbol;
    }

    const inputToken = getActionInputToken({
      actionDto: action.actionData,
      yieldDto: action.yieldData,
    });

    return inputToken?.symbol ?? yieldToken.symbol;
  }, [action.actionData, action.yieldData, direction]);

  const amount = useMemo(
    () =>
      Maybe.fromNullable(action.actionData.amount).map(defaultFormattedNumber),
    [action.actionData.amount]
  );

  const isPositive = direction === "deposit" || direction === "rewards";

  const amountSign = useMemo(() => {
    if (amount.isNothing()) return "";
    if (direction === "withdraw") return "-";
    if (direction === "deposit" || direction === "rewards") return "+";
    return "";
  }, [amount, direction]);

  const title = useMemo(() => {
    switch (direction) {
      case "deposit":
        return t("activity.item.deposited", { token: tokenSymbol });
      case "withdraw":
        return t("activity.item.withdrew", { token: tokenSymbol });
      case "rewards":
        return t("activity.item.rewards");
      default:
        return t("activity.item.generic", {
          action: capitalizeFirstLetters(
            action.actionData.type.replaceAll("_", " ")
          ),
          token: tokenSymbol,
        });
    }
  }, [direction, t, tokenSymbol, action.actionData.type]);

  const { timestampAbsolute, timestampRelative } = useMemo(() => {
    const createdAt = action.actionData.createdAt;

    if (!createdAt) {
      return { timestampAbsolute: "", timestampRelative: "" };
    }

    const date = new Date(createdAt);
    const dayKind = getActivityDayKind(date);

    const time = date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const absolute =
      dayKind === "today"
        ? `${t("activity.date_group_labels.today")} · ${time}`
        : dayKind === "yesterday"
          ? t("activity.date_group_labels.yesterday")
          : date.toLocaleDateString(locale, {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });

    const relativeParts = getActivityRelativeTime(date);
    const relative =
      relativeParts.unit === "now"
        ? t("activity.time.now")
        : relativeParts.unit === "minutes"
          ? t("activity.time.minutes_ago", { count: relativeParts.value })
          : relativeParts.unit === "hours"
            ? t("activity.time.hours_ago", { count: relativeParts.value })
            : t("activity.time.days_ago", { count: relativeParts.value });

    return { timestampAbsolute: absolute, timestampRelative: relative };
  }, [action.actionData.createdAt, locale, t]);

  const showFailedBadge = action.actionData.status === ActionStatus.FAILED;

  return {
    integrationData,
    providersDetails,
    iconType,
    title,
    tokenSymbol,
    amount,
    amountSign,
    isPositive,
    timestampAbsolute,
    timestampRelative,
    showFailedBadge,
    badgeLabel: t("activity.failed"),
  };
};
