import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { TFunction } from "i18next";
import {
  deriveMarketPositionOverview,
  type MarketPosition,
} from "../../../../../domain/borrow/positions/market-position";
import { borrowTokenToAppToken } from "../../../../../shared/lib/borrow-token";
import {
  formatBorrowProviderName,
  formatPercent,
  formatUsd,
} from "../../../../../shared/lib/formatters";
import { formatNumber } from "../../../../../shared/lib/number-format";

type UnifiedManagePositionsStateInput = {
  readonly borrowPositionsResult: AsyncResult.AsyncResult<
    ReadonlyArray<MarketPosition>,
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

export const getBorrowMarketPositionListItemModel = ({
  position,
  t,
}: {
  readonly position: MarketPosition;
  readonly t: TFunction;
}) => {
  const debtBalance = position.balances.debt;
  const overview = deriveMarketPositionOverview(position);
  const headerToken = borrowTokenToAppToken({
    network: position.market.network,
    token: overview.headerToken,
  });

  return {
    balanceText: debtBalance
      ? `${formatNumber(debtBalance.balance, 6)} ${debtBalance.tokenSymbol}`
      : formatUsd(position.metrics.totalSuppliedUsd.toString()),
    borrowApy: formatPercent(position.metrics.borrowApy),
    headerToken,
    providerName: formatBorrowProviderName(position.integration.name),
    subValue: debtBalance
      ? `${formatPercent(overview.currentLtv)} ${t(
          "dashboard.borrow.position_details.ltv"
        )} · ${formatUsd(
          debtBalance.balanceUsd.toString()
        )} ${t("dashboard.borrow.position_details.debt").toLowerCase()}`
      : t("dashboard.borrow.position_details.supplied"),
    title: overview.title,
  };
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
