import type BigNumber from "bignumber.js";
import type { TFunction } from "i18next";

import type { CollateralToken } from "../../../../domain/borrow/collateral-token";
import type { Integration } from "../../../../domain/borrow/integration";
import {
  getBorrowMarketPairLabel,
  type Market,
} from "../../../../domain/borrow/market";
import { deriveMarketRiskLimits } from "../../../../domain/borrow/market-risk";
import { classifyRiskBand } from "../../../../domain/borrow/risk-band";
import { exactDecimal, exactZero } from "../../../../domain/finance/exact";
import { formatNetworkName } from "../../../../shared/lib/formatters";
import {
  formatFigureChange,
  formatPercent,
  formatRoundedPercent,
  formatTokenAmount,
  formatUsd,
  unavailableFigure,
} from "../../../../shared/lib/number-format";
import {
  formatBorrowProviderName,
  formatHealthFactor,
  formatLtv,
} from "../../../borrow-presentation/index";
import {
  type LtvMeter,
  type RiskValueTone,
  riskValueTone,
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
  /** The logo of what the value names, such as the provider's. */
  readonly logo?: { readonly name: string; readonly src?: string | undefined };
};

type BorrowMetricCard = {
  readonly id: string;
  readonly label: string;
  readonly subValue?: string;
  readonly value: string;
};

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
  networkLogo = null,
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
  /** The market network's logo, as the host maps it; `null` hides it. */
  readonly networkLogo?: string | null;
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
      label: t("borrow.details.borrow_apy"),
      subValue: market.loanToken.symbol,
      value: formatRoundedPercent(market.borrowRate, locale),
    },
    {
      id: "max-ltv",
      label: t("borrow.details.max_ltv"),
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
    return formatFigureChange(
      formatLtv,
      {
        after: displayedProjectedLtv,
        before: hasExistingPosition ? existingLtv : null,
      },
      locale
    );
  };
  const ltvValue = getLtvValue();
  // One band for the LTV, its meter and the health factor the form projects.
  const riskBand = classifyRiskBand({
    healthFactor,
    ltv: displayedProjectedLtv,
    maxLtv,
  });
  const riskTone = riskValueTone(riskBand);

  const getLoanValue = (): string => {
    if (hasExistingPosition) {
      return (
        formatFigureChange(
          formatUsd,
          { after: displayedDebtUsd, before: projection.existingDebtUsd },
          locale
        ) ?? unavailableFigure
      );
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
          label: t("borrow.form.ltv_ratio"),
          value: unavailableFigure,
          ...(projectionUnavailable
            ? { caption: t("borrow.form.projection_unavailable") }
            : {}),
        }
      : {
          id: "ltv",
          label: t("borrow.form.ltv_ratio"),
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
      label: t("borrow.details.max_ltv"),
      value: formatPercent(maxLtv, locale),
    },
    {
      id: "collateral-value",
      label: t("borrow.form.collateral_value"),
      value: hasExistingPosition
        ? (formatFigureChange(
            formatUsd,
            {
              after: displayedCollateralUsd,
              before: projection.existingCollateralUsd,
            },
            locale
          ) ?? unavailableFigure)
        : formatUsd(displayedCollateralUsd, locale),
    },
    {
      id: "loan",
      label: t("borrow.form.loan"),
      value: loanValue,
    },
    {
      id: "borrow-rate",
      label: t("borrow.form.borrow_rate"),
      value: formatRoundedPercent(market.borrowRate, locale),
    },
    {
      id: "health-factor",
      label: t("borrow.form.health_factor"),
      ...(healthFactor === null
        ? { value: unavailableFigure }
        : { tone: riskTone, value: formatHealthFactor(healthFactor, locale) }),
    },
  ];

  const marketRows: BorrowDetailsRow[] = [
    {
      id: "total-supply",
      label: t("borrow.details.total_supply"),
      value: formatUsd(
        market.totalSupply.multipliedBy(market.loanTokenPriceUsd),
        locale
      ),
    },
    {
      id: "total-borrow",
      label: t("borrow.details.total_borrow"),
      value: formatUsd(
        market.totalBorrow.multipliedBy(market.loanTokenPriceUsd),
        locale
      ),
    },
    {
      id: "available-liquidity",
      label: t("borrow.details.available_liquidity"),
      value: `${formatTokenAmount(market.availableLiquidity, locale, "down")} ${
        market.loanToken.symbol
      }`,
    },
    {
      id: "utilization",
      label: t("borrow.details.utilization"),
      value: formatPercent(market.utilizationRate, locale),
    },
  ];

  const providerName = formatBorrowProviderName(
    integration?.name ?? market.integrationId
  );
  const networkName = formatNetworkName(market.network);
  const protocolRows: BorrowDetailsRow[] = [
    {
      id: "provider",
      label: t("borrow.details.provider"),
      logo: { name: providerName, src: integration?.metadata.logoURI },
      value: providerName,
    },
    {
      id: "network",
      label: t("borrow.details.network"),
      ...(networkLogo === null
        ? {}
        : { logo: { name: networkName, src: networkLogo } }),
      value: networkName,
    },
    {
      id: "market-type",
      label: t("borrow.details.market_type"),
      value: t(`borrow.market_type.${market.type}`),
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
