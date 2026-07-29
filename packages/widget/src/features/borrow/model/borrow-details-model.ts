import BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import type { Integration } from "../../../domain/borrow/integration";
import type { Market } from "../../../domain/borrow/market";
import { deriveMarketRiskLimits } from "../../../domain/borrow/market-risk";
import {
  formatBorrowProviderName,
  formatHealthFactor,
  formatNetworkName,
  formatPercent,
  formatUsd,
} from "../../../shared/lib/formatters";
import { formatNumber } from "../../../shared/lib/number-format";
import type { BorrowFormProjection } from "./borrow-form";
import type { BorrowMarketWalletBalances } from "./wallet-balances";

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

const deriveLtv = ({
  collateralUsd,
  debtUsd,
}: {
  readonly collateralUsd: number;
  readonly debtUsd: number;
}) => {
  if (collateralUsd > 0) {
    return debtUsd / collateralUsd;
  }

  return debtUsd > 0 ? 1 : 0;
};

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
  const projectedLtv = deriveLtv({
    collateralUsd: collateralUsd.toNumber(),
    debtUsd: borrowUsd.toNumber(),
  });
  const marketRisk = deriveMarketRiskLimits(market);
  const maxLtv = projection
    ? projection.maxLtv
    : (collateralToken?.maxLtv ?? marketRisk.maxLtv);
  const displayedProjectedLtv = projection?.projectedLtv ?? projectedLtv;
  const existingLtv = projection
    ? deriveLtv({
        collateralUsd: projection.existingCollateralUsd.toNumber(),
        debtUsd: projection.existingDebtUsd.toNumber(),
      })
    : 0;
  const displayedCollateralUsd =
    projection?.projectedCollateralUsd ?? collateralUsd;
  const displayedDebtUsd = projection?.projectedDebtUsd ?? borrowUsd;
  const getHealthFactor = () => {
    if (projection) {
      return projection.projectedHealthFactor;
    }

    return displayedProjectedLtv > 0 && collateralToken
      ? collateralToken.liquidationThreshold / displayedProjectedLtv
      : null;
  };
  const healthFactor = getHealthFactor();
  const hasExistingPosition =
    projection != null &&
    (projection.existingCollateralUsd.gt(0) ||
      projection.existingDebtUsd.gt(0));

  const metricCards: BorrowMetricCard[] = [
    {
      id: "borrow-apy",
      label: t("dashboard.borrow.details.borrow_apy"),
      subValue: market.loanToken.symbol,
      value: formatPercent(market.borrowRate),
    },
    {
      id: "max-ltv",
      label: t("dashboard.borrow.details.max_ltv"),
      value: formatPercent(maxLtv),
    },
  ];

  const getLtvValue = (): ReactNode => {
    if (projection?.riskStatus === "unavailable") return "-";
    if (displayedCollateralUsd.isZero()) return "-";
    if (!hasExistingPosition) {
      return formatPercent(displayedProjectedLtv);
    }
    return formatTransition({
      current: formatPercent(existingLtv),
      projected: formatPercent(displayedProjectedLtv),
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
      value: formatPercent(maxLtv),
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
      value: formatPercent(market.borrowRate),
    },
    {
      id: "health-factor",
      label: t("dashboard.borrow.form.health_factor"),
      value: formatHealthFactor(healthFactor),
    },
  ];

  const marketRows: BorrowDetailsRow[] = [
    {
      id: "total-supply",
      label: t("dashboard.borrow.details.total_supply"),
      value: formatUsd(
        new BigNumber(market.totalSupply)
          .multipliedBy(market.loanTokenPriceUsd)
          .toString()
      ),
    },
    {
      id: "total-borrow",
      label: t("dashboard.borrow.details.total_borrow"),
      value: formatUsd(
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
      value: formatPercent(market.utilizationRate),
    },
  ];

  const protocolRows: BorrowDetailsRow[] = [
    {
      id: "provider",
      label: t("dashboard.borrow.details.provider"),
      value: formatBorrowProviderName(
        integration?.name ?? market.integrationId
      ),
    },
    {
      id: "network",
      label: t("dashboard.borrow.details.network"),
      value: formatNetworkName(market.network),
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
