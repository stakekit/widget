import type BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import type { CollateralToken } from "../../../../domain/borrow/catalog/collateral-token";
import type { Integration } from "../../../../domain/borrow/catalog/integration";
import {
  getBorrowMarketPairLabel,
  type Market,
} from "../../../../domain/borrow/catalog/market";
import {
  classifyHealthFactor,
  classifyLtv,
  type RiskLevel,
} from "../../../../domain/borrow/risk/ltv-limits";
import { deriveMarketRiskLimits } from "../../../../domain/borrow/risk/market-risk";
import { exactDecimal, exactZero } from "../../../../domain/finance/exact";
import {
  formatBorrowProviderName,
  formatNetworkName,
} from "../../../../shared/lib/formatters";
import {
  formatHealthFactor,
  formatLtv,
  formatNumber,
  formatPercent,
  formatUsd,
} from "../../../../shared/lib/number-format";
import type { DetailRowTone } from "../../../../shared/ui/components/details-section";
import type { BorrowFormProjection } from "./borrow-entry";

type BorrowDetailsRow = {
  readonly id: string;
  readonly label: string;
  readonly tone?: DetailRowTone;
  readonly value: string;
};

const riskLevelTone = {
  nearLimit: "warning",
  overLimit: "danger",
  safe: "default",
} as const satisfies Record<RiskLevel, DetailRowTone>;

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
  readonly price: BigNumber;
}) => amount.multipliedBy(price);

const deriveLtv = ({
  collateralUsd,
  debtUsd,
}: {
  readonly collateralUsd: BigNumber;
  readonly debtUsd: BigNumber;
}) => {
  if (collateralUsd.isGreaterThan(0)) {
    return debtUsd.dividedBy(collateralUsd);
  }

  return debtUsd.isGreaterThan(0) ? exactDecimal(1) : exactZero();
};

export const getBorrowDetailsModel = ({
  borrowAmount,
  collateralAmount,
  collateralToken,
  integration,
  locale,
  market,
  projection,
  t,
}: {
  readonly borrowAmount: BigNumber;
  readonly collateralAmount: BigNumber;
  readonly collateralToken: CollateralToken | null;
  readonly integration: Integration | null;
  readonly locale: string;
  readonly market: Market;
  readonly projection?: BorrowFormProjection;
  readonly t: TFunction;
}) => {
  const borrowUsd = getTokenUsdValue({
    amount: borrowAmount,
    price: market.loanTokenPriceUsd,
  });
  const collateralUsd = getTokenUsdValue({
    amount: collateralAmount,
    price: collateralToken?.priceUsd ?? exactZero(),
  });
  const projectedLtv = deriveLtv({
    collateralUsd,
    debtUsd: borrowUsd,
  });
  const marketRisk = deriveMarketRiskLimits(market);
  const maxLtv =
    projection?.maxLtv ?? collateralToken?.maxLtv ?? marketRisk.maxLtv;
  const displayedProjectedLtv = projection?.projectedLtv ?? projectedLtv;
  const existingLtv = projection
    ? deriveLtv({
        collateralUsd: projection.existingCollateralUsd,
        debtUsd: projection.existingDebtUsd,
      })
    : exactZero();
  const displayedCollateralUsd =
    projection?.projectedCollateralUsd ?? collateralUsd;
  const displayedDebtUsd = projection?.projectedDebtUsd ?? borrowUsd;
  const getHealthFactor = () => {
    if (projection) {
      return projection.projectedHealthFactor;
    }

    return displayedProjectedLtv.isGreaterThan(0) && collateralToken
      ? collateralToken.liquidationThreshold.dividedBy(displayedProjectedLtv)
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
      value: formatPercent(market.borrowRate, locale),
    },
    {
      id: "max-ltv",
      label: t("dashboard.borrow.details.max_ltv"),
      value: formatPercent(maxLtv, locale),
    },
  ];

  const getLtvValue = (): string | null => {
    if (
      projection?.riskStatus === "unavailable" ||
      displayedCollateralUsd.isZero()
    ) {
      return null;
    }
    if (!hasExistingPosition) {
      return formatLtv(displayedProjectedLtv, locale);
    }
    return formatTransition({
      current: formatLtv(existingLtv, locale),
      projected: formatLtv(displayedProjectedLtv, locale),
    });
  };
  const ltvValue = getLtvValue();

  const getLoanValue = (): string => {
    if (hasExistingPosition) {
      return formatTransition({
        current: formatUsd(projection.existingDebtUsd, locale),
        projected: formatUsd(displayedDebtUsd, locale),
      });
    }
    return borrowAmount.isZero()
      ? "-"
      : `${formatNumber(borrowAmount, locale, 6)} ${market.loanToken.symbol}`;
  };
  const loanValue = getLoanValue();

  const formRows: BorrowDetailsRow[] = [
    ...(ltvValue === null
      ? []
      : [
          {
            id: "ltv",
            label: t("dashboard.borrow.form.ltv_ratio"),
            tone: riskLevelTone[
              classifyLtv({ ltv: displayedProjectedLtv, maxLtv })
            ],
            value: ltvValue,
          },
        ]),
    {
      id: "max-ltv",
      label: t("dashboard.borrow.details.max_ltv"),
      value: formatPercent(maxLtv, locale),
    },
    {
      id: "collateral-value",
      label: t("dashboard.borrow.form.collateral_value"),
      value: hasExistingPosition
        ? formatTransition({
            current: formatUsd(projection.existingCollateralUsd, locale),
            projected: formatUsd(displayedCollateralUsd, locale),
          })
        : formatUsd(displayedCollateralUsd, locale),
    },
    {
      id: "loan",
      label: t("dashboard.borrow.form.loan"),
      value: loanValue,
    },
    {
      id: "borrow-rate",
      label: t("dashboard.borrow.form.borrow_rate"),
      value: formatPercent(market.borrowRate, locale),
    },
    ...(healthFactor === null
      ? []
      : [
          {
            id: "health-factor",
            label: t("dashboard.borrow.form.health_factor"),
            tone: riskLevelTone[classifyHealthFactor(healthFactor)],
            value: formatHealthFactor(healthFactor, locale),
          },
        ]),
  ];

  const marketRows: BorrowDetailsRow[] = [
    {
      id: "total-supply",
      label: t("dashboard.borrow.details.total_supply"),
      value: formatUsd(
        market.totalSupply.multipliedBy(market.loanTokenPriceUsd),
        locale
      ),
    },
    {
      id: "total-borrow",
      label: t("dashboard.borrow.details.total_borrow"),
      value: formatUsd(
        market.totalBorrow.multipliedBy(market.loanTokenPriceUsd),
        locale
      ),
    },
    {
      id: "available-liquidity",
      label: t("dashboard.borrow.details.available_liquidity"),
      value: `${formatNumber(market.availableLiquidity, locale, 4)} ${
        market.loanToken.symbol
      }`,
    },
    {
      id: "utilization",
      label: t("dashboard.borrow.details.utilization"),
      value: formatPercent(market.utilizationRate, locale),
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
