import { Option } from "effect";
import type { TFunction } from "i18next";
import {
  deriveMarketPositionOverview,
  type MarketPosition,
} from "../../../../../domain/borrow/positions/market-position";
import type { Presentable } from "../../../../../shared/effect/async-result";
import { borrowTokenToAppToken } from "../../../../../shared/lib/borrow-token";
import { formatBorrowProviderName } from "../../../../../shared/lib/formatters";
import {
  formatPercent,
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";

type UnifiedManagePositionsStateInput = {
  readonly borrowPositions: Presentable<ReadonlyArray<MarketPosition>, unknown>;
  readonly borrowWalletIsConnected: boolean;
  readonly earnPositions: Presentable<ReadonlyArray<unknown>, unknown>;
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
};

export const getBorrowMarketPositionListItemModel = ({
  locale,
  position,
  t,
}: {
  readonly locale: string;
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
      ? `${formatTokenAmount(debtBalance.balance, locale, "up")} ${debtBalance.tokenSymbol}`
      : formatUsd(position.metrics.totalSuppliedUsd.toString(), locale),
    borrowApy: formatPercent(position.metrics.borrowApy, locale),
    headerToken,
    providerName: formatBorrowProviderName(position.integration.name),
    subValue: debtBalance
      ? `${formatPercent(overview.currentLtv, locale)} ${t(
          "dashboard.borrow.position_details.ltv"
        )} · ${formatUsd(
          debtBalance.balanceUsd.toString(),
          locale
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

/**
 * The Manage list combines Earn and Borrow positions. A source that failed
 * with nothing to show counts as failed; one whose refetch failed keeps its
 * positions and only flags the list as incomplete.
 */
export const getUnifiedManagePositionsState = ({
  borrowPositions,
  borrowWalletIsConnected,
  earnPositions,
  isConnected,
  isConnecting,
}: UnifiedManagePositionsStateInput): UnifiedManagePositionsState => {
  const borrowPositionsCount =
    borrowPositions._tag === "Ready" ? borrowPositions.value.length : 0;
  const earnPositionsCount =
    earnPositions._tag === "Ready" ? earnPositions.value.length : 0;
  const borrowIsLoading =
    borrowWalletIsConnected && borrowPositions._tag === "Loading";
  const activeSourceCount =
    Number(isConnected) + Number(borrowWalletIsConnected);
  const failedSourceCount =
    Number(isConnected && earnPositions._tag === "Failed") +
    Number(borrowWalletIsConnected && borrowPositions._tag === "Failed");
  const refreshFailed =
    (isConnected &&
      earnPositions._tag === "Ready" &&
      Option.isSome(earnPositions.refreshFailure)) ||
    (borrowWalletIsConnected &&
      borrowPositions._tag === "Ready" &&
      Option.isSome(borrowPositions.refreshFailure));
  const totalPositionsCount = earnPositionsCount + borrowPositionsCount;
  const isAnyPositionsLoading =
    earnPositions._tag === "Loading" || borrowIsLoading;
  const hasOnlyErrors =
    activeSourceCount > 0 && failedSourceCount === activeSourceCount;
  const hasPartialError =
    !hasOnlyErrors && (failedSourceCount > 0 || refreshFailed);
  const showPositionsList =
    (isConnected && earnPositions._tag === "Ready") ||
    borrowPositionsCount > 0 ||
    hasPartialError;

  return {
    hasOnlyErrors,
    hasPartialError,
    isAnyPositionsLoading,
    showConnectWallet: !isConnected && !isConnecting,
    showEmptyPositions:
      isConnected &&
      !isAnyPositionsLoading &&
      !hasOnlyErrors &&
      !hasPartialError &&
      totalPositionsCount === 0,
    showPositionsList,
    totalPositionsCount,
  };
};
