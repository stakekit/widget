import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { Position as BorrowPosition } from "../../../../../domain/borrow/position";

type UnifiedManagePositionsStateInput = {
  readonly borrowPositionsResult: AsyncResult.AsyncResult<
    ReadonlyArray<BorrowPosition>,
    unknown
  >;
  readonly borrowWalletIsConnected: boolean;
  readonly earnIsError: boolean;
  readonly earnIsFetching: boolean;
  readonly earnIsLoading: boolean;
  readonly earnPositionsCount: number;
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
  readonly showEarnPositions: boolean;
};

type UnifiedManagePositionsState = {
  readonly hasOnlyErrors: boolean;
  readonly hasPartialError: boolean;
  readonly isAnyPositionsLoading: boolean;
  readonly showConnectWallet: boolean;
  readonly showEmptyPositions: boolean;
  readonly showPositionsList: boolean;
  readonly totalPositionsCount: number;
};

export const getUnifiedManagePositionsState = ({
  borrowPositionsResult,
  borrowWalletIsConnected,
  earnIsError,
  earnIsFetching,
  earnIsLoading,
  earnPositionsCount,
  isConnected,
  isConnecting,
  showEarnPositions,
}: UnifiedManagePositionsStateInput): UnifiedManagePositionsState => {
  const borrowPositions = AsyncResult.getOrElse(
    borrowPositionsResult,
    () => []
  );
  const borrowPositionsCount = borrowPositions.length;
  const borrowIsLoading =
    borrowWalletIsConnected &&
    (AsyncResult.isInitial(borrowPositionsResult) ||
      AsyncResult.isWaiting(borrowPositionsResult));
  const borrowIsError = AsyncResult.isFailure(borrowPositionsResult);
  const totalPositionsCount = earnPositionsCount + borrowPositionsCount;
  const isAnyPositionsLoading =
    (earnIsLoading && earnIsFetching) || borrowIsLoading;
  const hasOnlyErrors =
    earnIsError && borrowIsError && totalPositionsCount === 0;
  const hasPartialError =
    totalPositionsCount > 0 && (earnIsError || borrowIsError);
  const showPositionsList = showEarnPositions || borrowPositionsCount > 0;

  return {
    hasOnlyErrors,
    hasPartialError,
    isAnyPositionsLoading,
    showConnectWallet: !isConnected && !isConnecting,
    showEmptyPositions:
      isConnected && !isAnyPositionsLoading && totalPositionsCount === 0,
    showPositionsList,
    totalPositionsCount,
  };
};
