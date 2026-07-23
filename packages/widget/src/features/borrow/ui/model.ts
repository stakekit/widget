import BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import type { Integration } from "../../../domain/borrow/integration";
import type { Market } from "../../../domain/borrow/market";
import { projectLtvRatio } from "../../../domain/borrow/position-projection";
import { formatCompactUsd } from "../../../shared/lib/formatters";
import { formatNumber } from "../../../shared/lib/number-format";
import type { BorrowFormProjection } from "../atoms/form";
import type { BorrowMarketWalletBalances } from "../balances";

type BorrowDetailsRow = {
  readonly id: string;
  readonly label: string;
  readonly value: ReactNode;
};

type BorrowMetricCard = {
  readonly id: string;
  readonly label: string;
  readonly subValue?: string;
  readonly value: string;
};

const formatDecimalPercent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "-"
    : `${formatNumber(value * 100, 2)}%`;

const formatUsd = (value: BigNumber) =>
  value.isFinite() ? `$${formatNumber(value, 2)}` : "$0";

const formatTransition = ({
  current,
  projected,
}: {
  readonly current: string;
  readonly projected: string;
}) => (current === projected ? projected : `${current} -> ${projected}`);

const getTokenUsdValue = ({
  amount,
  price,
}: {
  readonly amount: BigNumber;
  readonly price: number;
}) => amount.multipliedBy(price);

export const getBorrowMarketPairLabel = (market: Market) => {
  const collateralToken = market.collateralTokens[0];

  return collateralToken
    ? `${collateralToken.token.symbol} / ${market.loanToken.symbol}`
    : market.loanToken.symbol;
};

export const getBorrowDetailsModel = ({
  balances,
  borrowAmount,
  collateralAmount,
  integration,
  market,
  projection,
  t,
}: {
  readonly balances: BorrowMarketWalletBalances | null;
  readonly borrowAmount: BigNumber;
  readonly collateralAmount: BigNumber;
  readonly integration: Integration | null;
  readonly market: Market;
  readonly projection?: BorrowFormProjection;
  readonly t: TFunction;
}) => {
  const collateralToken = balances?.selectedCollateralToken?.collateralToken;
  const borrowUsd = getTokenUsdValue({
    amount: borrowAmount,
    price: market.loanTokenPriceUsd,
  });
  const collateralUsd = getTokenUsdValue({
    amount: collateralAmount,
    price: collateralToken?.priceUsd ?? 0,
  });
  const projectedLtv = projectLtvRatio({
    collateralUsd: collateralUsd.toNumber(),
    debtUsd: borrowUsd.toNumber(),
  });
  const maxLtv = collateralToken?.maxLtv ?? market.getMaxLtv();
  const displayedProjectedLtv = projection?.projectedLtv ?? projectedLtv;
  const existingLtv = projection
    ? projectLtvRatio({
        collateralUsd: projection.existingCollateralUsd.toNumber(),
        debtUsd: projection.existingDebtUsd.toNumber(),
      })
    : 0;
  const displayedCollateralUsd =
    projection?.projectedCollateralUsd ?? collateralUsd;
  const displayedDebtUsd = projection?.projectedDebtUsd ?? borrowUsd;
  const healthFactor =
    projection?.projectedHealthFactor ??
    (displayedProjectedLtv > 0 && collateralToken
      ? collateralToken.liquidationThreshold / displayedProjectedLtv
      : null);
  const hasExistingPosition =
    projection != null &&
    (projection.existingCollateralUsd.gt(0) ||
      projection.existingDebtUsd.gt(0));

  const metricCards: BorrowMetricCard[] = [
    {
      id: "borrow-apy",
      label: t("dashboard.borrow.details.borrow_apy"),
      subValue: market.loanToken.symbol,
      value: formatDecimalPercent(market.borrowRate),
    },
    {
      id: "supply-apy",
      label: t("dashboard.borrow.details.supply_apy"),
      subValue: collateralToken?.token.symbol,
      value: formatDecimalPercent(collateralToken?.supplyRate),
    },
    {
      id: "max-ltv",
      label: t("dashboard.borrow.details.max_ltv"),
      value: formatDecimalPercent(maxLtv),
    },
  ];

  const getLtvValue = (): ReactNode => {
    if (displayedCollateralUsd.isZero()) return "-";
    if (!hasExistingPosition) {
      return formatDecimalPercent(displayedProjectedLtv);
    }
    return formatTransition({
      current: formatDecimalPercent(existingLtv),
      projected: formatDecimalPercent(displayedProjectedLtv),
    });
  };
  const ltvValue = getLtvValue();

  const getLoanValue = (): ReactNode => {
    if (hasExistingPosition) {
      return formatTransition({
        current: formatUsd(projection.existingDebtUsd),
        projected: formatUsd(displayedDebtUsd),
      });
    }
    return borrowAmount.isZero()
      ? "-"
      : `${formatNumber(borrowAmount, 6)} ${market.loanToken.symbol}`;
  };
  const loanValue = getLoanValue();

  const formRows: BorrowDetailsRow[] = [
    {
      id: "ltv",
      label: t("dashboard.borrow.form.ltv_ratio"),
      value: ltvValue,
    },
    {
      id: "max-ltv",
      label: t("dashboard.borrow.details.max_ltv"),
      value: formatDecimalPercent(maxLtv),
    },
    {
      id: "collateral-value",
      label: t("dashboard.borrow.form.collateral_value"),
      value: hasExistingPosition
        ? formatTransition({
            current: formatUsd(projection.existingCollateralUsd),
            projected: formatUsd(displayedCollateralUsd),
          })
        : formatUsd(displayedCollateralUsd),
    },
    {
      id: "loan",
      label: t("dashboard.borrow.form.loan"),
      value: loanValue,
    },
    {
      id: "borrow-rate",
      label: t("dashboard.borrow.form.borrow_rate"),
      value: formatDecimalPercent(market.borrowRate),
    },
    {
      id: "health-factor",
      label: t("dashboard.borrow.form.health_factor"),
      value: healthFactor == null ? "-" : formatNumber(healthFactor, 2),
    },
  ];

  const marketRows: BorrowDetailsRow[] = [
    {
      id: "total-supply",
      label: t("dashboard.borrow.details.total_supply"),
      value: formatCompactUsd(
        new BigNumber(market.totalSupply)
          .multipliedBy(market.loanTokenPriceUsd)
          .toString()
      ),
    },
    {
      id: "total-borrow",
      label: t("dashboard.borrow.details.total_borrow"),
      value: formatCompactUsd(
        new BigNumber(market.totalBorrow)
          .multipliedBy(market.loanTokenPriceUsd)
          .toString()
      ),
    },
    {
      id: "available-liquidity",
      label: t("dashboard.borrow.details.available_liquidity"),
      value: `${formatNumber(market.availableLiquidity, 4)} ${
        market.loanToken.symbol
      }`,
    },
    {
      id: "utilization",
      label: t("dashboard.borrow.details.utilization"),
      value: formatDecimalPercent(market.utilizationRate),
    },
  ];

  const protocolRows: BorrowDetailsRow[] = [
    {
      id: "provider",
      label: t("dashboard.borrow.details.provider"),
      value: integration?.name ?? market.integrationId,
    },
    {
      id: "network",
      label: t("dashboard.borrow.details.network"),
      value: market.network,
    },
    {
      id: "market-type",
      label: t("dashboard.borrow.details.market_type"),
      value: t(`dashboard.borrow.market_type.${market.type}`),
    },
  ];

  return {
    borrowUsd,
    collateralToken,
    collateralUsd,
    formRows,
    healthFactor,
    marketRows,
    metricCards,
    protocolRows,
    title: collateralToken
      ? `${collateralToken.token.symbol} / ${market.loanToken.symbol}`
      : getBorrowMarketPairLabel(market),
  };
};
