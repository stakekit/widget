import type BigNumber from "bignumber.js";
import type { TFunction } from "i18next";

import type { CollateralToken } from "../../../../domain/borrow/catalog/collateral-token";
import type { Integration } from "../../../../domain/borrow/catalog/integration";
import {
  getBorrowMarketPairLabel,
  type Market,
} from "../../../../domain/borrow/catalog/market";
import { deriveMarketRiskLimits } from "../../../../domain/borrow/risk/market-risk";
import { classifyRiskBand } from "../../../../domain/borrow/risk/risk-band";
import { exactDecimal, exactZero } from "../../../../domain/finance/exact";
import {
  formatBorrowProviderName,
  formatNetworkName,
} from "../../../../shared/lib/formatters";
import {
  formatHealthFactor,
  formatLtv,
  formatPercent,
  formatTokenAmount,
  formatUsd,
  unavailableFigure,
} from "../../../../shared/lib/number-format";
import {
  type LtvMeter,
  type RiskValueTone,
  riskBandValueTone,
  toLtvMeter,
} from "../../../borrow-transaction-flow/index";
import type { BorrowFormProjection } from "./borrow-entry";

type BorrowDetailsRow = {
  readonly id: string;
  readonly label: string;
  /** How the value reads: in its risk band, or plain. */
  readonly tone?: RiskValueTone;
  readonly value: string;
  /** The value as a thin gauge under the row: the projected LTV. */
  readonly meter?: LtvMeter;
  /** Context under the row, such as why its value is unavailable. */
  readonly caption?: string;
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
}) => (current === projected ? projected : `${current} → ${projected}`);

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
  projectedMaxLtv,
  t,
}: {
  readonly borrowAmount: BigNumber;
  readonly collateralAmount: BigNumber;
  readonly collateralToken: CollateralToken | null;
  readonly integration: Integration | null;
  readonly locale: string;
  readonly market: Market;
  readonly projection?: BorrowFormProjection | undefined;
  /**
   * The max LTV a captured flow projected, such as Review's: account-weighted
   * across the collaterals, as the projection would read it.
   */
  readonly projectedMaxLtv?: BigNumber | undefined;
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
    projectedMaxLtv ??
    projection?.maxLtv ??
    collateralToken?.maxLtv ??
    marketRisk.maxLtv;
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

  // The figures exist but can't be projected, such as when the account's
  // totals disagree with its collateral: say so rather than drop the rows.
  const projectionUnavailable = projection?.riskStatus === "unavailable";
  const getLtvValue = (): string | null => {
    if (
      (projection !== undefined && projection.riskStatus !== "available") ||
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
  // One band for the LTV, its meter and the health factor the form projects.
  const riskBand = classifyRiskBand({
    healthFactor,
    ltv: displayedProjectedLtv,
    maxLtv,
  });
  const riskTone = riskBand === null ? "default" : riskBandValueTone[riskBand];

  const getLoanValue = (): string => {
    if (hasExistingPosition) {
      return formatTransition({
        current: formatUsd(projection.existingDebtUsd, locale),
        projected: formatUsd(displayedDebtUsd, locale),
      });
    }
    return borrowAmount.isZero()
      ? unavailableFigure
      : `${formatTokenAmount(borrowAmount, locale, "up")} ${market.loanToken.symbol}`;
  };
  const loanValue = getLoanValue();

  // LTV and health factor always show: "—" until they can be projected.
  const formRows: BorrowDetailsRow[] = [
    ltvValue === null
      ? {
          id: "ltv",
          label: t("dashboard.borrow.form.ltv_ratio"),
          value: unavailableFigure,
          ...(projectionUnavailable
            ? { caption: t("dashboard.borrow.form.projection_unavailable") }
            : {}),
        }
      : {
          id: "ltv",
          label: t("dashboard.borrow.form.ltv_ratio"),
          tone: riskTone,
          value: ltvValue,
          meter: toLtvMeter({
            locale,
            ltv: displayedProjectedLtv,
            maxLtv,
            t,
          }),
        },
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
    {
      id: "health-factor",
      label: t("dashboard.borrow.form.health_factor"),
      ...(healthFactor === null
        ? { value: unavailableFigure }
        : { tone: riskTone, value: formatHealthFactor(healthFactor, locale) }),
    },
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
      value: `${formatTokenAmount(market.availableLiquidity, locale, "down")} ${
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
