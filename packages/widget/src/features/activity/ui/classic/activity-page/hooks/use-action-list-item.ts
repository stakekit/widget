import { useAtomValue } from "@effect/atom-react";
import { DateTime } from "effect";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActionStatus,
  type ActionType,
  getActionInputToken,
} from "../../../../../../domain/types/action";
import { presentationClockAtom } from "../../../../../../shared/effect/presentation-clock";
import {
  getActivityDayKind,
  getActivityRelativeTime,
} from "../../../../../../shared/lib/date";
import { capitalizeFirstLetters } from "../../../../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../../../../shared/lib/number-format";
import { useProvidersDetails } from "../../../../../earn/react/use-provider-details";
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

const ADDRESS_LIKE_TOKEN = /^0x[0-9a-fA-F]{40}$/;

const getReadableRawTokenSymbol = (
  value: string | null | undefined
): string | null => {
  if (!value || value === "0x" || ADDRESS_LIKE_TOKEN.test(value)) {
    return null;
  }

  return value;
};

const getFallbackTokenSymbol = ({
  direction,
  inputToken,
  outputToken,
  unknownTokenLabel,
}: {
  direction: ActivityDirection;
  inputToken: string | null | undefined;
  outputToken: string | null | undefined;
  unknownTokenLabel: string;
}) => {
  const preferredToken =
    direction === "withdraw" || direction === "other"
      ? (outputToken ?? inputToken)
      : (inputToken ?? outputToken);

  return getReadableRawTokenSymbol(preferredToken) ?? unknownTokenLabel;
};

export const useActionListItem = (action: ActionYieldDto) => {
  const { t, i18n } = useTranslation();
  const presentationTime = useAtomValue(presentationClockAtom);

  const locale = i18n.language;

  const integrationData = action.yieldData ?? null;

  const providersDetails = useProvidersDetails({
    integrationData,
    validators: action.validatorsData,
    selectedProviderYieldId: null,
  });

  const direction = useMemo(
    () => getDirection(action.actionData.type),
    [action.actionData.type]
  );

  const iconType = ICON_TYPE_MAP[direction];

  /** Deposits/rewards show the underlying input token, withdrawals the vault token. */
  const tokenSymbol = useMemo(() => {
    const yieldData = action.yieldData;

    if (!yieldData) {
      return getFallbackTokenSymbol({
        direction,
        inputToken: action.actionData.rawArguments?.inputToken,
        outputToken: action.actionData.rawArguments?.outputToken,
        unknownTokenLabel: t("activity.item.unknown_token"),
      });
    }

    const yieldToken = yieldData.token;

    if (direction === "withdraw" || direction === "other") {
      return yieldToken.symbol;
    }

    const inputToken = getActionInputToken({
      actionDto: action.actionData,
      yieldDto: yieldData,
    });

    return inputToken?.symbol ?? yieldToken.symbol;
  }, [action.actionData, action.yieldData, direction, t]);

  const amount = useMemo(
    () =>
      action.actionData.amount == null
        ? null
        : defaultFormattedNumber(action.actionData.amount),
    [action.actionData.amount]
  );

  const isPositive = direction === "deposit" || direction === "rewards";

  const amountSign = useMemo(() => {
    if (!amount) return "";
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

    if (!createdAt || !presentationTime) {
      return { timestampAbsolute: "", timestampRelative: "" };
    }

    const dayKind = getActivityDayKind(
      createdAt,
      presentationTime.now,
      presentationTime.timeZone
    );

    const time = DateTime.formatLocal(createdAt, {
      locale,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const absolute =
      dayKind === "today"
        ? `${t("activity.date_group_labels.today")} · ${time}`
        : dayKind === "yesterday"
          ? t("activity.date_group_labels.yesterday")
          : DateTime.formatLocal(createdAt, {
              locale,
              day: "2-digit",
              month: "short",
              year: "numeric",
            });

    const relativeParts = getActivityRelativeTime(
      createdAt,
      presentationTime.now
    );
    const relative =
      relativeParts.unit === "now"
        ? t("activity.time.now")
        : relativeParts.unit === "minutes"
          ? t("activity.time.minutes_ago", { count: relativeParts.value })
          : relativeParts.unit === "hours"
            ? t("activity.time.hours_ago", { count: relativeParts.value })
            : t("activity.time.days_ago", { count: relativeParts.value });

    return { timestampAbsolute: absolute, timestampRelative: relative };
  }, [action.actionData.createdAt, locale, presentationTime, t]);

  const showFailedBadge = action.actionData.status === ActionStatus.FAILED;
  const canOpenDetails = !!action.yieldData;
  const showUnavailableYieldDetails = !action.yieldData;

  return {
    canOpenDetails,
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
    showUnavailableYieldDetails,
    unavailableYieldLabel: t("activity.item.yield_unavailable"),
  };
};
