import { DateTime } from "effect";
import type { ActionTransaction } from "../../../domain/action/models";
import { isContinuableYieldAction } from "../../../domain/activity/action-capabilities";
import { formatDateTime } from "../../../shared/lib/date";
import { formatNumber } from "../../../shared/lib/number-format";
import type { YieldActivityItem } from "./activity-action";
import {
  type ActivityActionTitle,
  type ActivityPresentationTime,
  type ActivityStatusLabel,
  projectActivityActionListItem,
  projectActivityStatusLabel,
} from "./activity-action-list-item";

type ActivityDetailsTransactionStatus =
  | "confirmed"
  | "failed"
  | "in_progress"
  | "not_submitted"
  | "skipped";

type ActivityDetailsTransaction = Readonly<{
  readonly broadcastedAt: string | null;
  readonly error: string | null;
  readonly explorerUrl: string | null;
  readonly hash: string | null;
  readonly id: string;
  readonly status: ActivityDetailsTransactionStatus;
  readonly type: ActionTransaction["type"];
}>;

type ActivityDetailsTransactionsSummary =
  | { readonly _tag: "allConfirmed"; readonly count: number }
  | { readonly _tag: "failed"; readonly count: number }
  | { readonly _tag: "inProgress"; readonly count: number }
  | { readonly _tag: "total"; readonly count: number };

export type ActivityActionDetailsProjection = Readonly<{
  readonly amount: string | null;
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

const projectTransactionStatus = (
  status: ActionTransaction["status"]
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

export const projectActivityActionDetails = ({
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
