import { DateTime } from "effect";
import type { ActionTransaction } from "../../../domain/action/models";
import { isContinuableYieldAction } from "../../../domain/activity/action-capabilities";
import type { ActivityActionItem } from "./activity-action";
import {
  type ActivityActionTitle,
  type ActivityPresentationTime,
  type ActivityStatusLabel,
  projectActivityActionListItem,
  projectActivityStatusLabel,
} from "./activity-action-list-item";

type ActivityDetailsTransaction = Readonly<{
  readonly error: string | null;
  readonly explorerUrl: string | null;
  readonly id: string;
  readonly status: ActionTransaction["status"];
  readonly title: string;
}>;

export type ActivityActionDetailsProjection = Readonly<{
  readonly amount: string | null;
  readonly canContinue: boolean;
  readonly completedAt: string | null;
  readonly continuationUnavailable: boolean;
  readonly createdAt: string;
  readonly network: string;
  readonly statusLabel: ActivityStatusLabel;
  readonly title: ActivityActionTitle;
  readonly tokenSymbol: string | null;
  readonly transactions: ReadonlyArray<ActivityDetailsTransaction>;
}>;

const formatDate = (
  value: DateTime.Utc,
  locale: string,
  timeZone: DateTime.TimeZone
) =>
  DateTime.formatLocal(DateTime.setZone(value, timeZone), {
    locale,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const projectActivityActionDetails = ({
  item,
  locale,
  presentationTime,
}: {
  readonly item: ActivityActionItem;
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
  const exactAmount = action.amount?.toFixed() ?? null;
  const amount = exactAmount ? `${listItem.amountSign}${exactAmount}` : null;

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
    transactions: action.transactions.map((transaction) => ({
      error: transaction.error ?? null,
      explorerUrl: transaction.explorerUrl ?? null,
      id: transaction.id,
      status: transaction.status,
      title: transaction.title,
    })),
  };
};
