import { DateTime } from "effect";
import {
  ActionStatus,
  type ActionType,
  findYieldToken,
  getActionInputToken,
} from "../../../domain/action/rules";
import { isContinuableYieldAction } from "../../../domain/activity/action-capabilities";
import { toBorrowNetworkToken } from "../../../domain/borrow/catalog/token";
import {
  type ConfidentialActionKind,
  type ConfidentialSettlement,
  getConfidentialActionKind,
  getConfidentialSettlement,
} from "../../../domain/earn/confidential";
import { getExitAmountToken } from "../../../domain/earn/denomination";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { fromBaseUnits } from "../../../domain/finance/base-units";
import type { Token } from "../../../domain/token/token";
import {
  formatDateTime,
  getActivityRelativeTime,
} from "../../../shared/lib/date";
import { sentenceCaseEnumValue } from "../../../shared/lib/formatters";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../shared/lib/number-format";
import type {
  ActivityActionItem,
  BorrowActivityItem,
  YieldActivityItem,
} from "./activity-action";
import { getActivityDayKey } from "./activity-days";

export type ActivityDirection = "deposit" | "withdraw" | "rewards" | "neutral";

export type ActivityStatusLabel =
  /** A confidential deposit or private exit waiting for its batch to run. */
  | "awaiting_settlement"
  | "canceled"
  | "completed"
  | "created"
  | "expired"
  | "failed"
  /** Waiting for its next transaction; a yield action continues from Activity. */
  | "in_progress"
  | "processing"
  | "stale";

type BorrowActivityActionType = BorrowActivityItem["actionData"]["action"];

export type ActivityActionTitle =
  | { readonly _tag: "deposited"; readonly tokenSymbol: string | null }
  /** A deposit still under way: it reads as what it does, not what it did. */
  | { readonly _tag: "deposit"; readonly tokenSymbol: string | null }
  /** Confidential deposits only settle when a later batch runs. */
  | { readonly _tag: "deposit_submitted"; readonly tokenSymbol: string | null }
  /** A confidential deposit its batch cancelled. */
  | { readonly _tag: "deposit_canceled"; readonly tokenSymbol: string | null }
  | { readonly _tag: "withdrew"; readonly tokenSymbol: string | null }
  /** A withdrawal still under way. */
  | { readonly _tag: "withdraw"; readonly tokenSymbol: string | null }
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
      /** Still under way: it reads as what it does, not what it did. */
      readonly inProgress: boolean;
      readonly tokenSymbol: string | null;
    };

export type ActivityPresentationTime = {
  readonly now: DateTime.Utc;
  readonly timeZone: DateTime.TimeZone;
};

/**
 * When a row's action happened, under the header of the day it was created:
 * how long ago within a day, its time of day after that, with its date too
 * when that falls on another day.
 */
type ActivityListTime =
  | { readonly unit: "now" }
  | { readonly unit: "minutes" | "hours"; readonly value: number }
  | { readonly unit: "clock"; readonly label: string };

type ActivityActionListItemProjection = {
  readonly amount: string | null;
  /** `−` is the minus sign (U+2212), as negative figures read everywhere. */
  readonly amountSign: "" | "+" | "−";
  readonly direction: ActivityDirection;
  readonly isPositive: boolean;
  readonly statusLabel: ActivityStatusLabel | null;
  /**
   * It ended without taking effect (failed or canceled): its amount never
   * moved, and its time is when it ended.
   */
  readonly voided: boolean;
  /**
   * When the action was created, or when it ended if voided; the receipt
   * gives its full dates and times.
   */
  readonly time: ActivityListTime | null;
  readonly title: ActivityActionTitle;
  /** The token the action names, whose logo leads its row and receipt. */
  readonly token: Token | null;
  /** The symbol of the token the amount is in. */
  readonly amountTokenSymbol: string | null;
  /** The amount in USD, which a row shows when its token is unknown. */
  readonly amountFiat: string | null;
  /** The amount a row shows, signed: see `resolveAmountText`. */
  readonly amountText: string | null;
};

const projectActivityListTime = ({
  at,
  createdAt,
  locale,
  presentationTime,
}: {
  readonly at: DateTime.Utc;
  readonly createdAt: DateTime.Utc;
  readonly locale: string;
  readonly presentationTime: ActivityPresentationTime | null;
}): ActivityListTime | null => {
  if (!presentationTime) return null;
  const { now, timeZone } = presentationTime;
  const relative = getActivityRelativeTime(at, now);
  switch (relative.unit) {
    case "now":
      return relative;
    case "minutes":
    case "hours":
      return { unit: relative.unit, value: relative.value };
    case "days": {
      const onCreationDay =
        getActivityDayKey(at, timeZone) ===
        getActivityDayKey(createdAt, timeZone);
      return {
        unit: "clock",
        label: formatDateTime(at, {
          locale,
          timeZone,
          hour: "numeric",
          minute: "2-digit",
          ...(onCreationDay ? {} : { day: "numeric", month: "short" }),
        }),
      };
    }
  }
};

/**
 * Whether an outcome took no effect, so its amount never moved. An expired
 * action is not: it stopped waiting for its next transaction after earlier
 * ones confirmed.
 */
const VOIDED_STATUS: Record<ActivityStatusLabel, boolean> = {
  awaiting_settlement: false,
  canceled: true,
  completed: false,
  created: false,
  expired: false,
  failed: true,
  in_progress: false,
  processing: false,
  stale: false,
};

/**
 * When a voided Yield action ended: its batch's cancellation, its completion,
 * else when its last transaction was sent, else its creation. Transactions
 * are created with the action, so only a send dates its end.
 */
const resolveYieldEndedAt = (
  action: YieldActivityItem["actionData"],
  settlement: ConfidentialSettlement | null
): DateTime.Utc => {
  if (settlement?._tag === "Cancelled") return settlement.at;
  if (action.completedAt) return action.completedAt;
  return action.transactions.reduce(
    (latest, { broadcastedAt }) =>
      broadcastedAt ? DateTime.max(latest, broadcastedAt) : latest,
    action.createdAt
  );
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

// Borrow rows cannot be continued from Activity; waiting still reads as under way.
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
  WAITING_FOR_NEXT: "in_progress",
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

/** A waiting action is in progress until its continuation window closes. */
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
        : "in_progress";
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

/**
 * The tokens an action shows: its amount in the token of the field it came
 * from, its title in what it put in or paid out. An enter is in its input
 * token; an exit's amount is in the Exit Unit and its title names the Exit
 * Receive Token; any other action pays the Value Token.
 */
const resolveActivityActionTokens = (
  yieldData: EarnYieldWithProvider,
  action: YieldActivityItem["actionData"]
): Readonly<{ readonly amountToken: Token; readonly titleToken: Token }> => {
  switch (action.intent) {
    case "enter": {
      const token =
        getActionInputToken({ actionDto: action, yieldDto: yieldData }) ??
        yieldData.token;
      return { amountToken: token, titleToken: token };
    }
    case "exit": {
      const amountToken = getExitAmountToken(yieldData);
      const outputToken = action.rawArguments?.outputToken;
      return {
        amountToken,
        titleToken:
          (outputToken ? findYieldToken(yieldData, outputToken) : undefined) ??
          amountToken,
      };
    }
    case "manage":
      return { amountToken: yieldData.token, titleToken: yieldData.token };
  }
};

/**
 * The symbols a row shows and the token its logo shows. A yield the API no
 * longer lists leaves only the raw token its arguments name: a symbol, with
 * no logo.
 */
const resolveListTokens = ({
  action,
  direction,
}: {
  readonly action: YieldActivityItem;
  readonly direction: ActivityDirection;
}): Readonly<{
  readonly amountTokenSymbol: string | null;
  readonly titleToken: Token | null;
  readonly titleTokenSymbol: string | null;
}> => {
  const yieldData = action.yieldData;

  if (!yieldData) {
    const { inputToken, outputToken } = action.actionData.rawArguments ?? {};
    const preferredToken =
      direction === "withdraw" || direction === "neutral"
        ? (outputToken ?? inputToken)
        : (inputToken ?? outputToken);
    const symbol = getReadableRawTokenSymbol(preferredToken);

    return {
      amountTokenSymbol: symbol,
      titleToken: null,
      titleTokenSymbol: symbol,
    };
  }

  const yieldTokenSymbol = getReadableRawTokenSymbol(yieldData.token.symbol);
  const { amountToken, titleToken } = resolveActivityActionTokens(
    yieldData,
    action.actionData
  );

  return {
    amountTokenSymbol:
      getReadableRawTokenSymbol(amountToken.symbol) ?? yieldTokenSymbol,
    titleToken,
    titleTokenSymbol:
      getReadableRawTokenSymbol(titleToken.symbol) ?? yieldTokenSymbol,
  };
};

const resolveAmountSign = ({
  shown,
  direction,
}: {
  /** The amount shown, in its token or in USD. */
  readonly shown: string | null;
  readonly direction: ActivityDirection;
}): "" | "+" | "−" => {
  if (!shown) return "";
  if (direction === "withdraw") return "−";
  if (direction === "deposit" || direction === "rewards") return "+";
  return "";
};

/**
 * The amount a row shows, signed: in its token, or in USD when the token is
 * unknown. With neither, none: a number without its unit is no amount.
 */
const resolveAmountText = ({
  amount,
  amountFiat,
  amountSign,
  amountTokenSymbol,
}: {
  readonly amount: string | null;
  readonly amountFiat: string | null;
  readonly amountSign: "" | "+" | "−";
  readonly amountTokenSymbol: string | null;
}) => {
  if (amount && amountTokenSymbol) {
    return `${amountSign}${amount} ${amountTokenSymbol}`;
  }
  return amountFiat ? `${amountSign}${amountFiat}` : null;
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
  const waiting = action.actionData.status === ActionStatus.WAITING_FOR_NEXT;
  switch (direction) {
    case "deposit":
      if (confidentialKind !== "deposit" || settlement?._tag === "Settled") {
        return waiting
          ? { _tag: "deposit", tokenSymbol }
          : { _tag: "deposited", tokenSymbol };
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
      return waiting
        ? { _tag: "withdraw", tokenSymbol }
        : { _tag: "withdrew", tokenSymbol };
    case "rewards":
      return { _tag: "rewards" };
    default:
      return {
        _tag: "generic",
        actionLabel: sentenceCaseEnumValue(action.actionData.type),
        tokenSymbol,
      };
  }
};

// Borrow actions carry either a decimal amount or base units in the token's decimals.
export const resolveBorrowActivityAmount = ({
  actionData,
  token,
}: BorrowActivityItem) => {
  const { amount, amountRaw } = actionData.rawArguments ?? {};
  if (amount) return amount;
  if (amountRaw === undefined || !token) return null;

  return fromBaseUnits(amountRaw, token.decimals);
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

  const amountSign = resolveAmountSign({ shown: amount, direction });
  // Borrow actions carry no USD value.
  const amountFiat = null;

  const statusLabel = BORROW_ACTIVITY_STATUS_LABEL[borrowAction.status];
  const voided = VOIDED_STATUS[statusLabel];

  return {
    amount,
    amountSign,
    direction,
    isPositive: direction === "deposit",
    statusLabel,
    voided,
    // A Borrow action records only when it was created.
    time: projectActivityListTime({
      at: borrowAction.createdAt,
      createdAt: borrowAction.createdAt,
      locale,
      presentationTime,
    }),
    title: {
      _tag: "borrow",
      action: borrowAction.action,
      inProgress:
        statusLabel === "created" ||
        statusLabel === "processing" ||
        statusLabel === "in_progress",
      tokenSymbol,
    },
    token: action.token
      ? toBorrowNetworkToken({ network: action.network, token: action.token })
      : null,
    amountTokenSymbol: tokenSymbol,
    amountFiat,
    amountText: resolveAmountText({
      amount,
      amountFiat,
      amountSign,
      amountTokenSymbol: tokenSymbol,
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
  if (action._tag === "borrow") {
    return projectBorrowActivityListItem({ action, locale, presentationTime });
  }

  const direction = getActivityDirection(action.actionData.type);
  const confidentialKind = action.yieldData
    ? getConfidentialActionKind(action.yieldData, action.actionData)
    : null;
  const settlement = getActivitySettlement(action);
  const { amountTokenSymbol, titleToken, titleTokenSymbol } = resolveListTokens(
    {
      action,
      direction,
    }
  );
  const amount =
    action.actionData.amount == null
      ? null
      : formatTokenAmount(action.actionData.amount, locale, "down");
  const amountFiat = action.actionData.amountUsd?.isGreaterThan(0)
    ? formatUsd(action.actionData.amountUsd, locale)
    : null;
  const amountSign = resolveAmountSign({
    shown: amount ?? amountFiat,
    direction,
  });

  const statusLabel = projectActivityStatusLabel(
    action.actionData,
    settlement,
    presentationTime
  );
  const voided = statusLabel !== null && VOIDED_STATUS[statusLabel];
  const { createdAt } = action.actionData;

  return {
    amount,
    amountSign,
    direction,
    isPositive: direction === "deposit" || direction === "rewards",
    statusLabel,
    voided,
    time: projectActivityListTime({
      at: voided
        ? resolveYieldEndedAt(action.actionData, settlement)
        : createdAt,
      createdAt,
      locale,
      presentationTime,
    }),
    title: resolveTitle({
      action,
      confidentialKind,
      direction,
      settlement,
      tokenSymbol: titleTokenSymbol,
    }),
    token: titleToken,
    amountTokenSymbol,
    amountFiat,
    amountText: resolveAmountText({
      amount,
      amountFiat,
      amountSign,
      amountTokenSymbol,
    }),
  };
};
