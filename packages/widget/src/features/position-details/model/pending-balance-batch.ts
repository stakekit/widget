import { type DateTime, Array as EArray } from "effect";
import type { TFunction } from "i18next";
import type { PositionBalanceRow } from "../../../domain/portfolio/positions";
import { formatDateTime } from "../../../shared/lib/date";
import { formatAddress } from "../../../shared/lib/general";

type BatchLink = Readonly<{
  readonly key: string;
  readonly label: string;
  readonly url: string;
}>;

export type PendingBalanceBatchDetails = Readonly<{
  readonly batcher: BatchLink;
  readonly requests: ReadonlyArray<BatchLink>;
  readonly requestsLabel: string;
  readonly title: string;
}>;

/** The first balance row of each batch; rows sharing one differ only by token or date. */
export const getPendingBatchRows = (rows: ReadonlyArray<PositionBalanceRow>) =>
  EArray.dedupeWith(
    rows.filter((row) => row.batch),
    (a, b) =>
      a.batch?.address === b.batch?.address && a.batch?.id === b.batch?.id
  );

export const getPendingBalanceBatchDetails = ({
  balance,
  locale,
  t,
  timeZone,
}: {
  readonly balance: Pick<PositionBalanceRow, "batch" | "type">;
  readonly locale: string;
  readonly t: TFunction;
  readonly timeZone: DateTime.TimeZone;
}): PendingBalanceBatchDetails | null => {
  const batch = balance.batch;
  if (!batch) return null;
  const kind = balance.type === "entering" ? "deposits" : "withdrawals";

  return {
    batcher: {
      key: batch.address,
      label: formatAddress(batch.address, {
        leadingChars: 6,
        trailingChars: 4,
      }),
      url: batch.explorerUrl,
    },
    requests: batch.requests.map((request) => ({
      key: request.transactionHash,
      label: formatDateTime(request.submittedAt, {
        day: "numeric",
        hour: "2-digit",
        hour12: false,
        locale,
        minute: "2-digit",
        month: "short",
        timeZone,
      }),
      url: request.explorerUrl,
    })),
    requestsLabel: t(`position_details.batch.${kind}`, {
      count: batch.requests.length,
    }),
    title: t("position_details.batch.title", { id: batch.id }),
  };
};
