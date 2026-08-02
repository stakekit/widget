type BorrowFlowOutcomeReceipt = Readonly<{
  readonly entry:
    | Readonly<{ readonly _tag: "BorrowEntry" }>
    | Readonly<{
        readonly _tag: "MarketPosition";
        readonly marketId: string;
      }>;
  readonly epoch: number;
  readonly phase: "Done" | "ExecutionStarted";
}>;

export type BorrowFlowOutcomeCursor = Readonly<{
  readonly epoch: number;
  readonly rank: number;
}>;

export const initialBorrowFlowOutcomeCursor: BorrowFlowOutcomeCursor = {
  epoch: 0,
  rank: 0,
};

const outcomeRank = (receipt: BorrowFlowOutcomeReceipt): number =>
  receipt.phase === "ExecutionStarted" ? 1 : 2;

const isAfterCursor = (
  cursor: BorrowFlowOutcomeCursor,
  receipt: BorrowFlowOutcomeReceipt
): boolean => {
  const rank = outcomeRank(receipt);
  return (
    receipt.epoch > cursor.epoch ||
    (receipt.epoch === cursor.epoch && rank > cursor.rank)
  );
};

const advanceCursor = (
  receipt: BorrowFlowOutcomeReceipt
): BorrowFlowOutcomeCursor => ({
  epoch: receipt.epoch,
  rank: outcomeRank(receipt),
});

export const resolveBorrowEntryOutcomeReceipt = ({
  cursor,
  receipt,
}: {
  readonly cursor: BorrowFlowOutcomeCursor;
  readonly receipt: BorrowFlowOutcomeReceipt | null;
}): Readonly<{
  readonly cursor: BorrowFlowOutcomeCursor;
  readonly reset: boolean;
}> => {
  if (
    receipt?.entry._tag !== "BorrowEntry" ||
    !isAfterCursor(cursor, receipt)
  ) {
    return { cursor, reset: false };
  }

  return {
    cursor: advanceCursor(receipt),
    reset: receipt.phase === "Done",
  };
};

export const resolveMarketPositionOutcomeReceipt = ({
  cursor,
  marketId,
  receipt,
}: {
  readonly cursor: BorrowFlowOutcomeCursor;
  readonly marketId: string;
  readonly receipt: BorrowFlowOutcomeReceipt | null;
}): Readonly<{
  readonly cursor: BorrowFlowOutcomeCursor;
  readonly reset: boolean;
}> => {
  if (
    receipt?.entry._tag !== "MarketPosition" ||
    receipt.entry.marketId !== marketId ||
    !isAfterCursor(cursor, receipt)
  ) {
    return { cursor, reset: false };
  }

  return {
    cursor: advanceCursor(receipt),
    reset: receipt.phase === "ExecutionStarted" || receipt.phase === "Done",
  };
};
