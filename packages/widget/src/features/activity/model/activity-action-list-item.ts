import type { DateTime } from "effect";
import {
  ActionStatus,
  type ActionType,
  findYieldToken,
  getActionInputToken,
} from "../../../domain/action/rules";
import { isContinuableYieldAction } from "../../../domain/activity/action-capabilities";
import {
  type ConfidentialActionKind,
  type ConfidentialSettlement,
  getConfidentialActionKind,
  getConfidentialAssetToken,
  getConfidentialSettlement,
} from "../../../domain/earn/confidential";
import type { EarnYieldWithProvider } from "../../../domain/earn/models";
import { exactDecimal } from "../../../domain/finance/exact";
import type { Token } from "../../../domain/token/token";
import {
  formatDateTime,
  getActivityDayKind,
  getActivityRelativeTime,
} from "../../../shared/lib/date";
import { capitalizeFirstLetters } from "../../../shared/lib/formatters";
import { formatTokenAmount } from "../../../shared/lib/number-format";
import type {
  ActivityActionItem,
  BorrowActivityItem,
  YieldActivityItem,
} from "./activity-action";

export type ActivityDirection = "deposit" | "withdraw" | "rewards" | "neutral";

export type ActivityStatusLabel =
  /** A confidential deposit or private exit waiting for its batch to run. */
  | "awaiting_settlement"
  | "canceled"
  | "completed"
  | "created"
  | "expired"
  | "failed"
  | "processing"
  | "stale";

type BorrowActivityActionType = BorrowActivityItem["actionData"]["action"];

export type ActivityActionTitle =
  | { readonly _tag: "deposited"; readonly tokenSymbol: string | null }
  /** Confidential deposits only settle when a later batch runs. */
  | { readonly _tag: "deposit_submitted"; readonly tokenSymbol: string | null }
  /** A confidential deposit its batch cancelled. */
  | { readonly _tag: "deposit_canceled"; readonly tokenSymbol: string | null }
  | { readonly _tag: "withdrew"; readonly tokenSymbol: string | null }
  /** A confidential private exit only joins the next redemption batch. */
  | {
      readonly _tag: "private_withdrawal_requested";
      readonly tokenSymbol: string | null;
    }
  /** A confidential private exit its batch cancelled. */
  | {
      readonly _tag: "private_withdrawal_canceled";
      readonly tokenSymbol: string | null;
    }
  /** The WITHDRAW that pays out a confidential instant exit. */
  | {
      readonly _tag: "instant_withdrawal_finalized";
      readonly tokenSymbol: string | null;
    }
  | { readonly _tag: "rewards" }
  | {
      readonly _tag: "generic";
      readonly actionLabel: string;
      readonly tokenSymbol: string | null;
    }
  | {
      readonly _tag: "borrow";
      readonly action: BorrowActivityActionType;
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
    case "MERGE":
    case "VERIFY_WITHDRAW_CREDENTIALS":
    case "DELEGATE":
    case "CANCEL_PENDING":
      return "neutral";
  }
};

const BORROW_ACTIVITY_DIRECTION: Record<
  BorrowActivityActionType,
  ActivityDirection
> = {
  borrow: "neutral",
  disableCollateral: "neutral",
  enableCollateral: "neutral",
  repay: "neutral",
  supply: "deposit",
  supplyAndBorrow: "deposit",
  withdraw: "withdraw",
};

// Borrow rows cannot be continued from Activity, so waiting reads as processing.
const BORROW_ACTIVITY_STATUS_LABEL: Record<
  BorrowActivityItem["actionData"]["status"],
  ActivityStatusLabel
> = {
  CANCELED: "canceled",
  CREATED: "created",
  FAILED: "failed",
  PROCESSING: "processing",
  STALE: "stale",
  SUCCESS: "completed",
  WAITING_FOR_NEXT: "processing",
};

/** How a confidential deposit's or private exit's batch resolved, if it is one. */
export const getActivitySettlement = ({
  actionData,
  yieldData,
}: YieldActivityItem): ConfidentialSettlement | null =>
  yieldData ? getConfidentialSettlement(yieldData, actionData) : null;

const SETTLEMENT_STATUS_LABEL: Record<
  ConfidentialSettlement["_tag"],
  ActivityStatusLabel
> = {
  Awaiting: "awaiting_settlement",
  Cancelled: "canceled",
  Settled: "completed",
};

/** Waiting actions show no badge: the user may have continued elsewhere. */
const projectActivityStatusLabel = (
  action: YieldActivityItem["actionData"],
  settlement: ConfidentialSettlement | null,
  presentationTime: ActivityPresentationTime | null
): ActivityStatusLabel | null => {
  if (settlement) return SETTLEMENT_STATUS_LABEL[settlement._tag];
  switch (action.status) {
    case ActionStatus.SUCCESS:
      return "completed";
    case ActionStatus.FAILED:
      return "failed";
    case ActionStatus.WAITING_FOR_NEXT:
      return presentationTime &&
        !isContinuableYieldAction(action, presentationTime.now)
        ? "expired"
        : null;
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

// A confidential exit pays out the token it names; a private one without one
// returns the confidential asset.
const resolveConfidentialWithdrawalToken = ({
  action,
  confidentialKind,
  yieldData,
}: {
  readonly action: YieldActivityItem["actionData"];
  readonly confidentialKind: ConfidentialActionKind;
  readonly yieldData: EarnYieldWithProvider;
}): Token => {
  const outputToken = action.rawArguments?.outputToken;

  return (
    (outputToken ? findYieldToken(yieldData, outputToken) : undefined) ??
    (confidentialKind === "privateExit"
      ? getConfidentialAssetToken(yieldData)
      : null) ??
    yieldData.token
  );
};

const resolveTokenSymbol = ({
  action,
  confidentialKind,
  direction,
}: {
  readonly action: YieldActivityItem;
  readonly confidentialKind: ConfidentialActionKind | null;
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
  if (direction === "withdraw" && confidentialKind) {
    const token = resolveConfidentialWithdrawalToken({
      action: action.actionData,
      confidentialKind,
      yieldData,
    });

    return getReadableRawTokenSymbol(token.symbol) ?? yieldTokenSymbol;
  }
  if (direction === "withdraw" || direction === "neutral") {
    return yieldTokenSymbol;
  }
  // A confidential deposit always enters as the confidential asset, whatever
  // the user wrapped it from.
  const confidentialAsset =
    confidentialKind === "deposit"
      ? getConfidentialAssetToken(yieldData)
      : null;
  if (confidentialAsset) {
    return (
      getReadableRawTokenSymbol(confidentialAsset.symbol) ?? yieldTokenSymbol
    );
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
  confidentialKind,
  direction,
  settlement,
  tokenSymbol,
}: {
  readonly action: YieldActivityItem;
  readonly confidentialKind: ConfidentialActionKind | null;
  readonly direction: ActivityDirection;
  readonly settlement: ConfidentialSettlement | null;
  readonly tokenSymbol: string | null;
}): ActivityActionTitle => {
  switch (direction) {
    case "deposit":
      if (confidentialKind !== "deposit" || settlement?._tag === "Settled") {
        return { _tag: "deposited", tokenSymbol };
      }
      return settlement?._tag === "Cancelled"
        ? { _tag: "deposit_canceled", tokenSymbol }
        : { _tag: "deposit_submitted", tokenSymbol };
    case "withdraw":
      if (confidentialKind === "privateExit") {
        if (settlement?._tag === "Settled") {
          return { _tag: "withdrew", tokenSymbol };
        }
        return settlement?._tag === "Cancelled"
          ? { _tag: "private_withdrawal_canceled", tokenSymbol }
          : { _tag: "private_withdrawal_requested", tokenSymbol };
      }
      if (confidentialKind === "instantExitPayout") {
        return { _tag: "instant_withdrawal_finalized", tokenSymbol };
      }
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
  createdAt,
  locale,
  presentationTime,
}: {
  readonly createdAt: DateTime.Utc | null | undefined;
  readonly locale: string;
  readonly presentationTime: ActivityPresentationTime | null;
}): ActivityActionTimestamp | null => {
  if (!createdAt || !presentationTime) return null;

  return {
    date: formatDateTime(createdAt, {
      locale,
      timeZone: presentationTime.timeZone,
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
    time: formatDateTime(createdAt, {
      locale,
      timeZone: presentationTime.timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  };
};

// Borrow actions carry either a decimal amount or base units in the token's decimals.
export const resolveBorrowActivityAmount = ({
  actionData,
  token,
}: BorrowActivityItem) => {
  const { amount, amountRaw } = actionData.rawArguments ?? {};
  if (amount) return amount;
  if (amountRaw === undefined || !token) return null;

  return exactDecimal(amountRaw.toString()).shiftedBy(-token.decimals);
};

const projectBorrowActivityListItem = ({
  action,
  locale,
  presentationTime,
}: {
  readonly action: BorrowActivityItem;
  readonly locale: string;
  readonly presentationTime: ActivityPresentationTime | null;
}): ActivityActionListItemProjection => {
  const borrowAction = action.actionData;
  const direction = BORROW_ACTIVITY_DIRECTION[borrowAction.action];
  const tokenSymbol = getReadableRawTokenSymbol(action.token?.symbol);
  const exactAmount = resolveBorrowActivityAmount(action);
  const amount = exactAmount
    ? formatTokenAmount(exactAmount, locale, "down")
    : null;

  return {
    amount,
    amountSign: resolveAmountSign({ amount, direction }),
    direction,
    isPositive: direction === "deposit",
    statusLabel: BORROW_ACTIVITY_STATUS_LABEL[borrowAction.status],
    timestamp: resolveTimestamp({
      createdAt: borrowAction.createdAt,
      locale,
      presentationTime,
    }),
    title: { _tag: "borrow", action: borrowAction.action, tokenSymbol },
    tokenSymbol,
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
  if (action._tag === "borrow") {
    return projectBorrowActivityListItem({ action, locale, presentationTime });
  }

  const direction = getActivityDirection(action.actionData.type);
  const confidentialKind = action.yieldData
    ? getConfidentialActionKind(action.yieldData, action.actionData)
    : null;
  const settlement = getActivitySettlement(action);
  const tokenSymbol = resolveTokenSymbol({
    action,
    confidentialKind,
    direction,
  });
  const amount =
    action.actionData.amount == null
      ? null
      : formatTokenAmount(action.actionData.amount, locale, "down");

  return {
    amount,
    amountSign: resolveAmountSign({ amount, direction }),
    direction,
    isPositive: direction === "deposit" || direction === "rewards",
    statusLabel: projectActivityStatusLabel(
      action.actionData,
      settlement,
      presentationTime
    ),
    timestamp: resolveTimestamp({
      createdAt: action.actionData.createdAt,
      locale,
      presentationTime,
    }),
    title: resolveTitle({
      action,
      confidentialKind,
      direction,
      settlement,
      tokenSymbol,
    }),
    tokenSymbol,
  };
};
