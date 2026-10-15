import type BigNumber from "bignumber.js";
import { DateTime } from "effect";
import type { ActionTransaction } from "../../../domain/action/models";
import { isContinuableYieldAction } from "../../../domain/activity/action-capabilities";
import { getBorrowMarketPairLabel } from "../../../domain/borrow/catalog/market";
import type { BorrowToken } from "../../../domain/borrow/catalog/token";
import type { BorrowActivityAction } from "../../../domain/borrow/responses";
import { formatDateTime } from "../../../shared/lib/date";
import {
  formatFigureChange,
  formatHealthFactor,
  formatLtv,
  formatNumber,
} from "../../../shared/lib/number-format";
import type {
  ActivityActionItem,
  BorrowActivityItem,
  YieldActivityItem,
} from "./activity-action";
import {
  type ActivityActionTitle,
  type ActivityPresentationTime,
  type ActivityStatusLabel,
  projectActivityActionListItem,
  projectActivityStatusLabel,
  resolveBorrowActivityAmount,
} from "./activity-action-list-item";
import { findBorrowMarketToken } from "./activity-enrichment";

type BorrowActivityTransaction = BorrowActivityAction["transactions"][number];

type ActivityDetailsTransactionStatus =
  | "confirmed"
  | "failed"
  | "in_progress"
  | "not_submitted"
  | "skipped";

type ActivityDetailsTransactionFields = Readonly<{
  readonly broadcastedAt: string | null;
  readonly error: string | null;
  readonly explorerUrl: string | null;
  readonly hash: string | null;
  readonly id: string;
  readonly status: ActivityDetailsTransactionStatus;
}>;

/** Yield and Borrow name transaction types from different vocabularies. */
type ActivityDetailsTransaction =
  | (ActivityDetailsTransactionFields & {
      readonly _tag: "yield";
      readonly type: ActionTransaction["type"];
    })
  | (ActivityDetailsTransactionFields & {
      readonly _tag: "borrow";
      readonly type: BorrowActivityTransaction["type"];
    });

type ActivityDetailsTransactionsSummary =
  | { readonly _tag: "allConfirmed"; readonly count: number }
  | { readonly _tag: "failed"; readonly count: number }
  | { readonly _tag: "inProgress"; readonly count: number }
  | { readonly _tag: "total"; readonly count: number };

/** Borrow-only receipt rows; each is absent when its fact is unknown. */
type ActivityBorrowDetailsProjection = Readonly<{
  readonly collateralFee: string | null;
  readonly healthFactor: string | null;
  readonly ltv: string | null;
  readonly market: string | null;
  readonly originationFee: string | null;
}>;

export type ActivityActionDetailsProjection = Readonly<{
  readonly amount: string | null;
  readonly borrow: ActivityBorrowDetailsProjection | null;
  readonly canContinue: boolean;
  readonly completedAt: string | null;
  readonly continuationUnavailable: boolean;
  readonly createdAt: string;
  readonly network: string;
  readonly statusLabel: ActivityStatusLabel | null;
  readonly title: ActivityActionTitle;
  readonly tokenSymbol: string | null;
  readonly transactions: ReadonlyArray<ActivityDetailsTransaction>;
  readonly transactionsSummary: ActivityDetailsTransactionsSummary;
}>;

const formatDate = (
  value: DateTime.Utc,
  locale: string,
  timeZone: DateTime.TimeZone
) =>
  formatDateTime(value, {
    locale,
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Yield and Borrow transactions share the same ten statuses.
const projectTransactionStatus = (
  status: ActionTransaction["status"] | BorrowActivityTransaction["status"]
): ActivityDetailsTransactionStatus => {
  switch (status) {
    case "CONFIRMED":
      return "confirmed";
    case "FAILED":
    case "BLOCKED":
      return "failed";
    case "SKIPPED":
      return "skipped";
    case "SIGNED":
    case "BROADCASTED":
    case "PENDING":
      return "in_progress";
    case "NOT_FOUND":
    case "CREATED":
    case "WAITING_FOR_SIGNATURE":
      return "not_submitted";
  }
};

// Steps run in `stepIndex` order; the API does not guarantee array order.
const compareTransactionSteps = (
  left: ActionTransaction,
  right: ActionTransaction
) =>
  (left.stepIndex ?? Number.MAX_SAFE_INTEGER) -
    (right.stepIndex ?? Number.MAX_SAFE_INTEGER) ||
  DateTime.toEpochMillis(left.createdAt) -
    DateTime.toEpochMillis(right.createdAt);

const summarizeTransactions = (
  transactions: ReadonlyArray<ActivityDetailsTransaction>
): ActivityDetailsTransactionsSummary => {
  const failed = transactions.filter(
    (transaction) => transaction.status === "failed"
  ).length;
  if (failed > 0) return { _tag: "failed", count: failed };

  const inProgress = transactions.filter(
    (transaction) => transaction.status === "in_progress"
  ).length;
  if (inProgress > 0) return { _tag: "inProgress", count: inProgress };

  return transactions.every((transaction) => transaction.status === "confirmed")
    ? { _tag: "allConfirmed", count: transactions.length }
    : { _tag: "total", count: transactions.length };
};

const projectYieldActivityDetails = ({
  item,
  locale,
  presentationTime,
}: {
  readonly item: YieldActivityItem;
  readonly locale: string;
  readonly presentationTime: ActivityPresentationTime;
}): ActivityActionDetailsProjection => {
  const action = item.actionData;
  const listItem = projectActivityActionListItem({
    action: item,
    locale,
    presentationTime,
  });
  const canContinue =
    item.yieldData !== null &&
    isContinuableYieldAction(action, presentationTime.now);
  const continuationWindowOpen = isContinuableYieldAction(
    action,
    presentationTime.now
  );
  const statusLabel = projectActivityStatusLabel(action, presentationTime);
  const amount = action.amount
    ? `${listItem.amountSign}${formatNumber(action.amount, locale)}`
    : null;
  const transactions = action.transactions
    .toSorted(compareTransactionSteps)
    .map(
      (transaction): ActivityDetailsTransaction => ({
        _tag: "yield",
        broadcastedAt: transaction.broadcastedAt
          ? formatDate(
              transaction.broadcastedAt,
              locale,
              presentationTime.timeZone
            )
          : null,
        error: transaction.error ?? null,
        explorerUrl: transaction.explorerUrl ?? null,
        hash: transaction.hash,
        id: transaction.id,
        status: projectTransactionStatus(transaction.status),
        type: transaction.type,
      })
    );

  return {
    amount,
    borrow: null,
    canContinue,
    completedAt: action.completedAt
      ? formatDate(action.completedAt, locale, presentationTime.timeZone)
      : null,
    continuationUnavailable:
      action.status === "WAITING_FOR_NEXT" &&
      item.yieldData === null &&
      continuationWindowOpen,
    createdAt: formatDate(action.createdAt, locale, presentationTime.timeZone),
    network: item.yieldData?.token.network ?? item.walletScope.network,
    statusLabel,
    title: listItem.title,
    tokenSymbol: listItem.tokenSymbol,
    transactions,
    transactionsSummary: summarizeTransactions(transactions),
  };
};

/** Fee text in the fee's token; zero or unknown fees are not shown. */
const formatBorrowFee = (
  amount: BigNumber | undefined,
  token: BorrowToken | null,
  locale: string
) => {
  if (!amount || amount.isZero()) return null;
  const formatted = formatNumber(amount, locale);
  return token ? `${formatted} ${token.symbol}` : formatted;
};

// Collateral fees are charged in the supplied collateral token.
const resolveCollateralFeeToken = ({
  actionData,
  market,
  token,
}: BorrowActivityItem): BorrowToken | null => {
  const collateralAddress = actionData.rawArguments?.collateralTokenAddress;
  if (market && collateralAddress) {
    return findBorrowMarketToken(market, collateralAddress);
  }
  return actionData.action === "supply" ? token : null;
};

const projectBorrowActivityDetails = ({
  item,
  locale,
  presentationTime,
}: {
  readonly item: BorrowActivityItem;
  readonly locale: string;
  readonly presentationTime: ActivityPresentationTime;
}): ActivityActionDetailsProjection => {
  const action = item.actionData;
  const metadata = action.metadata ?? null;
  const listItem = projectActivityActionListItem({
    action: item,
    locale,
    presentationTime,
  });
  const exactAmount = resolveBorrowActivityAmount(item);
  // The API returns the current step's transactions in order, without hashes.
  const transactions = action.transactions.map(
    (transaction): ActivityDetailsTransaction => ({
      _tag: "borrow",
      broadcastedAt: null,
      error: null,
      explorerUrl: null,
      hash: null,
      id: transaction.id,
      status: projectTransactionStatus(transaction.status),
      type: transaction.type,
    })
  );

  return {
    amount: exactAmount
      ? `${listItem.amountSign}${formatNumber(exactAmount, locale)}`
      : null,
    borrow: {
      collateralFee: formatBorrowFee(
        metadata?.feeAmount,
        resolveCollateralFeeToken(item),
        locale
      ),
      healthFactor: formatFigureChange(
        formatHealthFactor,
        metadata?.predictedHealthFactor
          ? {
              after: metadata.predictedHealthFactor,
              before: metadata.currentHealthFactor,
            }
          : null,
        locale
      ),
      ltv: formatFigureChange(
        formatLtv,
        metadata
          ? { after: metadata.predictedLtv, before: metadata.currentLtv }
          : null,
        locale
      ),
      market: item.market ? getBorrowMarketPairLabel(item.market) : null,
      originationFee: formatBorrowFee(
        metadata?.originationFeeAmount,
        item.market?.loanToken ?? null,
        locale
      ),
    },
    canContinue: false,
    completedAt: null,
    continuationUnavailable: false,
    createdAt: formatDate(action.createdAt, locale, presentationTime.timeZone),
    network: item.network,
    statusLabel: listItem.statusLabel,
    title: listItem.title,
    tokenSymbol: listItem.tokenSymbol,
    transactions,
    transactionsSummary: summarizeTransactions(transactions),
  };
};

export const projectActivityActionDetails = ({
  item,
  locale,
  presentationTime,
}: {
  readonly item: ActivityActionItem;
  readonly locale: string;
  readonly presentationTime: ActivityPresentationTime;
}): ActivityActionDetailsProjection =>
  item._tag === "yield"
    ? projectYieldActivityDetails({ item, locale, presentationTime })
    : projectBorrowActivityDetails({ item, locale, presentationTime });
