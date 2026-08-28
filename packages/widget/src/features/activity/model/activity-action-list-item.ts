import { DateTime } from "effect";
import {
  ActionStatus,
  type ActionType,
  getActionInputToken,
} from "../../../domain/action/rules";
import { isContinuableYieldAction } from "../../../domain/activity/action-capabilities";
import {
  getActivityDayKind,
  getActivityRelativeTime,
} from "../../../shared/lib/date";
import { capitalizeFirstLetters } from "../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../shared/lib/number-format";
import type { ActivityActionItem } from "./activity-action";

export type ActivityDirection = "deposit" | "withdraw" | "rewards" | "neutral";

export type ActivityStatusLabel =
  | "action-required"
  | "canceled"
  | "completed"
  | "created"
  | "expired"
  | "failed"
  | "processing"
  | "stale";

export type ActivityActionTitle =
  | { readonly _tag: "deposited"; readonly tokenSymbol: string | null }
  | { readonly _tag: "withdrew"; readonly tokenSymbol: string | null }
  | { readonly _tag: "rewards" }
  | {
      readonly _tag: "generic";
      readonly actionLabel: string;
      readonly tokenSymbol: string | null;
    };

export type ActivityPresentationTime = {
  readonly now: DateTime.Utc;
  readonly timeZone: DateTime.TimeZone;
};

type ActivityActionTimestamp = {
  readonly date: string;
  readonly dayKind: ReturnType<typeof getActivityDayKind>;
  readonly relative: ReturnType<typeof getActivityRelativeTime>;
  readonly time: string;
};

type ActivityActionListItemProjection = {
  readonly amount: string | null;
  readonly amountSign: "" | "+" | "-";
  readonly canOpenDetails: boolean;
  readonly direction: ActivityDirection;
  readonly isPositive: boolean;
  readonly statusLabel: ActivityStatusLabel | null;
  readonly timestamp: ActivityActionTimestamp | null;
  readonly title: ActivityActionTitle;
  readonly tokenSymbol: string | null;
};

const getActivityDirection = (type: ActionType): ActivityDirection => {
  switch (type) {
    case "STAKE":
    case "STAKE_LOCKED":
    case "RESTAKE":
    case "REBOND":
      return "deposit";
    case "UNSTAKE":
    case "WITHDRAW_REQUEST":
    case "INSTANT_WITHDRAW":
    case "WITHDRAW":
    case "WITHDRAW_ALL":
    case "CLAIM_UNSTAKED":
    case "UNLOCK_LOCKED":
      return "withdraw";
    case "CLAIM_REWARDS":
    case "RESTAKE_REWARDS":
    case "AUTO_SWEEP_UNSTAKE_REWARDS":
    case "AUTO_SWEEP_WITHDRAW_REWARDS":
      return "rewards";
    case "VOTE":
    case "REVOKE":
    case "VOTE_LOCKED":
    case "REVOTE":
    case "MIGRATE":
    case "VERIFY_WITHDRAW_CREDENTIALS":
    case "DELEGATE":
      return "neutral";
  }
};

export const projectActivityStatusLabel = (
  action: ActivityActionItem["actionData"],
  presentationTime: ActivityPresentationTime | null
): ActivityStatusLabel => {
  switch (action.status) {
    case ActionStatus.SUCCESS:
      return "completed";
    case ActionStatus.FAILED:
      return "failed";
    case ActionStatus.WAITING_FOR_NEXT:
      return presentationTime &&
        !isContinuableYieldAction(action, presentationTime.now)
        ? "expired"
        : "action-required";
    case ActionStatus.CANCELED:
      return "canceled";
    case ActionStatus.CREATED:
      return "created";
    case ActionStatus.PROCESSING:
      return "processing";
    case ActionStatus.STALE:
      return "stale";
  }
};

const ADDRESS_LIKE_TOKEN = /^0x[0-9a-fA-F]{40}$/i;

const getReadableRawTokenSymbol = (
  value: string | null | undefined
): string | null => {
  const normalizedValue = value?.trim();

  if (
    !normalizedValue ||
    normalizedValue.toLowerCase() === "0x" ||
    ADDRESS_LIKE_TOKEN.test(normalizedValue)
  ) {
    return null;
  }

  return normalizedValue;
};

const resolveTokenSymbol = ({
  action,
  direction,
}: {
  readonly action: ActivityActionItem;
  readonly direction: ActivityDirection;
}): string | null => {
  const yieldData = action.yieldData;

  if (!yieldData) {
    const { inputToken, outputToken } = action.actionData.rawArguments ?? {};
    const preferredToken =
      direction === "withdraw" || direction === "neutral"
        ? (outputToken ?? inputToken)
        : (inputToken ?? outputToken);

    return getReadableRawTokenSymbol(preferredToken);
  }

  const yieldTokenSymbol = getReadableRawTokenSymbol(yieldData.token.symbol);
  if (direction === "withdraw" || direction === "neutral") {
    return yieldTokenSymbol;
  }

  const inputToken = getActionInputToken({
    actionDto: action.actionData,
    yieldDto: yieldData,
  });

  return getReadableRawTokenSymbol(inputToken?.symbol) ?? yieldTokenSymbol;
};

const resolveAmountSign = ({
  amount,
  direction,
}: {
  readonly amount: string | null;
  readonly direction: ActivityDirection;
}): "" | "+" | "-" => {
  if (!amount) return "";
  if (direction === "withdraw") return "-";
  if (direction === "deposit" || direction === "rewards") return "+";
  return "";
};

const resolveTitle = ({
  action,
  direction,
  tokenSymbol,
}: {
  readonly action: ActivityActionItem;
  readonly direction: ActivityDirection;
  readonly tokenSymbol: string | null;
}): ActivityActionTitle => {
  switch (direction) {
    case "deposit":
      return { _tag: "deposited", tokenSymbol };
    case "withdraw":
      return { _tag: "withdrew", tokenSymbol };
    case "rewards":
      return { _tag: "rewards" };
    default:
      return {
        _tag: "generic",
        actionLabel: capitalizeFirstLetters(
          action.actionData.type.replaceAll("_", " ")
        ),
        tokenSymbol,
      };
  }
};

const resolveTimestamp = ({
  action,
  locale,
  presentationTime,
}: {
  readonly action: ActivityActionItem;
  readonly locale: string;
  readonly presentationTime: ActivityPresentationTime | null;
}): ActivityActionTimestamp | null => {
  const createdAt = action.actionData.createdAt;
  if (!createdAt || !presentationTime) return null;

  return {
    date: DateTime.formatLocal(createdAt, {
      locale,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    dayKind: getActivityDayKind(
      createdAt,
      presentationTime.now,
      presentationTime.timeZone
    ),
    relative: getActivityRelativeTime(createdAt, presentationTime.now),
    time: DateTime.formatLocal(createdAt, {
      locale,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  };
};

export const projectActivityActionListItem = ({
  action,
  locale,
  presentationTime,
}: {
  readonly action: ActivityActionItem;
  readonly locale: string;
  readonly presentationTime: ActivityPresentationTime | null;
}): ActivityActionListItemProjection => {
  const direction = getActivityDirection(action.actionData.type);
  const tokenSymbol = resolveTokenSymbol({
    action,
    direction,
  });
  const amount =
    action.actionData.amount == null
      ? null
      : defaultFormattedNumber(action.actionData.amount);

  return {
    amount,
    amountSign: resolveAmountSign({ amount, direction }),
    canOpenDetails: true,
    direction,
    isPositive: direction === "deposit" || direction === "rewards",
    statusLabel: projectActivityStatusLabel(
      action.actionData,
      presentationTime
    ),
    timestamp: resolveTimestamp({ action, locale, presentationTime }),
    title: resolveTitle({ action, direction, tokenSymbol }),
    tokenSymbol,
  };
};
