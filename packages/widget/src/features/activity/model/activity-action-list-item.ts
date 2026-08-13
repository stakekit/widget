import { DateTime } from "effect";
import {
  ActionStatus,
  type ActionType,
  getActionInputToken,
} from "../../../domain/action/rules";
import {
  getActivityDayKind,
  getActivityRelativeTime,
} from "../../../shared/lib/date";
import { capitalizeFirstLetters } from "../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../shared/lib/number-format";
import {
  type ActivityActionItem,
  getActivityActionOpenTarget,
} from "./activity-action";

export type ActivityDirection = "deposit" | "withdraw" | "rewards" | "other";

type ActivityActionTitle =
  | { readonly _tag: "deposited"; readonly tokenSymbol: string }
  | { readonly _tag: "withdrew"; readonly tokenSymbol: string }
  | { readonly _tag: "rewards" }
  | {
      readonly _tag: "generic";
      readonly actionLabel: string;
      readonly tokenSymbol: string;
    };

type ActivityPresentationTime = {
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
  readonly showFailedBadge: boolean;
  readonly showUnavailableYieldDetails: boolean;
  readonly timestamp: ActivityActionTimestamp | null;
  readonly title: ActivityActionTitle;
  readonly tokenSymbol: string;
};

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

const getActivityDirection = (type: ActionType): ActivityDirection => {
  if (DEPOSIT_ACTIONS.has(type)) return "deposit";
  if (WITHDRAW_ACTIONS.has(type)) return "withdraw";
  if (REWARD_ACTIONS.has(type)) return "rewards";
  return "other";
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
      direction === "withdraw" || direction === "other"
        ? (outputToken ?? inputToken)
        : (inputToken ?? outputToken);

    return getReadableRawTokenSymbol(preferredToken);
  }

  const yieldTokenSymbol = getReadableRawTokenSymbol(yieldData.token.symbol);
  if (direction === "withdraw" || direction === "other") {
    return yieldTokenSymbol;
  }

  const inputToken = getActionInputToken({
    actionDto: action.actionData,
    yieldDto: yieldData,
  });

  return getReadableRawTokenSymbol(inputToken?.symbol) ?? yieldTokenSymbol;
};

export const getActivityActionTokenSymbol = (
  action: ActivityActionItem
): string | null =>
  resolveTokenSymbol({
    action,
    direction: getActivityDirection(action.actionData.type),
  });

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
  readonly tokenSymbol: string;
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
}): ActivityActionListItemProjection | null => {
  const direction = getActivityDirection(action.actionData.type);
  const tokenSymbol = resolveTokenSymbol({
    action,
    direction,
  });
  if (!tokenSymbol) return null;

  const amount =
    action.actionData.amount == null
      ? null
      : defaultFormattedNumber(action.actionData.amount);

  return {
    amount,
    amountSign: resolveAmountSign({ amount, direction }),
    canOpenDetails:
      action.yieldData !== null &&
      getActivityActionOpenTarget(action.actionData.status) !== null,
    direction,
    isPositive: direction === "deposit" || direction === "rewards",
    showFailedBadge: action.actionData.status === ActionStatus.FAILED,
    showUnavailableYieldDetails: action.yieldData === null,
    timestamp: resolveTimestamp({ action, locale, presentationTime }),
    title: resolveTitle({ action, direction, tokenSymbol }),
    tokenSymbol,
  };
};
