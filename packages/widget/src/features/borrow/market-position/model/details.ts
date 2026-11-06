import type BigNumber from "bignumber.js";
import type { TFunction } from "i18next";

import {
  deriveMarketPositionOverview,
  type MarketPosition,
} from "../../../../domain/borrow/positions/market-position";
import type { BorrowPositionActionKey } from "../../../../domain/borrow/positions/position-action-key";
import { deriveMarketRiskLimits } from "../../../../domain/borrow/risk/market-risk";
import {
  classifyRiskBand,
  liquidationPriceDrop,
  type RiskBand,
} from "../../../../domain/borrow/risk/risk-band";
import { borrowTokenToAppToken } from "../../../../shared/lib/borrow-token";
import {
  formatBorrowProviderName,
  formatNetworkName,
} from "../../../../shared/lib/formatters";
import {
  formatHealthFactor,
  formatPercent,
  formatTokenAmount,
  formatUsd,
} from "../../../../shared/lib/number-format";
import {
  type RiskValueTone,
  riskBandValueTone,
} from "../../../borrow-transaction-flow/index";
import type {
  BorrowPositionPendingActionContext,
  BorrowWithdrawTokenOption,
} from "../../action-preparation/index";

/** A figure beside the net worth in the position's summary. */
type BorrowPositionSummaryMetric = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** A risk figure's tone: the position's risk band. */
  readonly tone?: RiskValueTone;
};

/**
 * The alert a position at risk of liquidation raises: a warning in caution,
 * danger in danger, with Repay as its way out.
 */
export type BorrowPositionRiskAlert = {
  readonly tone: "warning" | "danger";
  readonly title: string;
  readonly body: string;
};

const getRiskAlert = ({
  band,
  healthFactor,
  locale,
  t,
}: {
  readonly band: RiskBand | null;
  readonly healthFactor: BigNumber | null;
  readonly locale: string;
  readonly t: TFunction;
}): BorrowPositionRiskAlert | null => {
  if (band === null || band === "safe") return null;

  const drop =
    healthFactor === null ? null : liquidationPriceDrop(healthFactor);
  const getBody = () => {
    if (drop === null) return t("dashboard.borrow.risk.alert.near_max_ltv");
    if (drop.isZero()) return t("dashboard.borrow.risk.alert.liquidatable");
    return t("dashboard.borrow.risk.alert.price_drop", {
      drop: formatPercent(drop, locale),
    });
  };

  return {
    tone: band === "danger" ? "danger" : "warning",
    title: t(`dashboard.borrow.risk.alert.${band}_title`),
    body: getBody(),
  };
};

type BorrowPositionDetailRow = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
};

export type BorrowPositionAction = {
  readonly id: BorrowPositionActionKey;
  readonly label: string;
  readonly pendingContext: BorrowPositionPendingActionContext;
  readonly type:
    | "disableCollateral"
    | "enableCollateral"
    | "repay"
    | "withdraw";
};

export const isBorrowCollateralToggleAction = (
  action: BorrowPositionAction
): boolean =>
  action.type === "disableCollateral" || action.type === "enableCollateral";

type BorrowPositionActionDescriptor = Omit<BorrowPositionAction, "label">;

const getBorrowWithdrawTokenOptions = (
  position: MarketPosition
): BorrowWithdrawTokenOption[] =>
  position.actions.supply.flatMap((action) => {
    if (action.type !== "withdraw") {
      return [];
    }

    const supplyBalance = position.balances.supply.find(
      (balance) => balance.tokenAddress === action.args.tokenAddress
    );
    const collateralToken = position.market.collateralTokens.find(
      (candidate) => candidate.token.address === action.args.tokenAddress
    );

    if (!supplyBalance || !collateralToken) {
      return [];
    }

    return [
      {
        action,
        availableAmount: supplyBalance.balance,
        collateralToken,
        supplyBalance,
      },
    ];
  });

export const getBorrowPositionActions = ({
  position,
  t,
}: {
  readonly position: MarketPosition;
  readonly t: TFunction;
}): BorrowPositionAction[] =>
  getBorrowPositionActionDescriptors(position).map((action) => ({
    ...action,
    label: t(`dashboard.borrow.position_details.actions.${action.type}`),
  }));

export const getBorrowPositionActionDescriptors = (
  position: MarketPosition
): BorrowPositionActionDescriptor[] => {
  const actions: BorrowPositionActionDescriptor[] = [];

  for (const action of position.actions.debt) {
    if (action.type !== "repay" || !position.balances.debt) {
      continue;
    }

    actions.push({
      id: `${action.type}-${action.args.tokenAddress}`,
      pendingContext: {
        action,
        debtBalance: position.balances.debt,
        position,
        type: "repay",
      },
      type: "repay",
    });
  }

  const withdrawTokens = getBorrowWithdrawTokenOptions(position);
  const defaultWithdrawToken = withdrawTokens[0];
  if (defaultWithdrawToken) {
    actions.push({
      id: "withdraw",
      pendingContext: {
        position,
        tokens: withdrawTokens,
        type: "withdraw",
      },
      type: "withdraw",
    });
  }

  for (const action of position.actions.supply) {
    const supplyBalance = position.balances.supply.find(
      (balance) => balance.tokenAddress === action.args.tokenAddress
    );

    if (!supplyBalance) {
      continue;
    }

    if (action.type === "withdraw") {
      continue;
    }

    if (
      action.type === "enableCollateral" ||
      action.type === "disableCollateral"
    ) {
      actions.push({
        id: `${action.type}-${action.args.tokenAddress}`,
        pendingContext: {
          action,
          position,
          supplyBalance,
          type: action.type,
        },
        type: action.type,
      });
    }
  }

  return actions;
};

type BorrowPositionCollateralItem = ReturnType<
  typeof getBorrowPositionDetailsModel
>["collateralItems"][number];

/**
 * Resolves the configurable action that toggles a collateral row, so the list
 * renders a switch only when the position actually offers that action.
 */
export const findBorrowCollateralToggleAction = ({
  actions,
  item,
}: {
  readonly actions: ReadonlyArray<BorrowPositionAction>;
  readonly item: BorrowPositionCollateralItem;
}): BorrowPositionAction | null => {
  const toggle = item.collateralToggleAction;

  if (!toggle) {
    return null;
  }

  return (
    actions.find(
      (action) =>
        action.type === toggle.action.type &&
        action.pendingContext.type === toggle.action.type &&
        action.pendingContext.supplyBalance.tokenAddress ===
          toggle.supplyBalance.tokenAddress
    ) ?? null
  );
};

export const getBorrowPositionDetailsModel = ({
  locale,
  position,
  t,
}: {
  readonly locale: string;
  readonly position: MarketPosition;
  readonly t: TFunction;
}) => {
  const debtBalance = position.balances.debt;
  const supplyBalances = position.balances.supply;
  const overview = deriveMarketPositionOverview(position);
  const currentRisk = position.risk.current;
  const currentLtv = overview.currentLtv;
  const healthFactor =
    currentRisk.status === "available" ? currentRisk.healthFactor : null;
  const marketRisk = deriveMarketRiskLimits(position.market);
  const maxLtv =
    (currentRisk.status === "available" ? currentRisk.maxLtv : null) ??
    marketRisk.maxLtv;
  const liquidationThreshold =
    currentRisk.status === "available"
      ? currentRisk.liquidationThreshold
      : marketRisk.liquidationThreshold;
  // One band for the LTV, its meter and the health factor.
  const riskBand = classifyRiskBand({ healthFactor, ltv: currentLtv, maxLtv });
  const riskTone = riskBand === null ? "default" : riskBandValueTone[riskBand];
  const summaryMetrics: BorrowPositionSummaryMetric[] = [
    {
      id: "debt",
      label: t("dashboard.borrow.position_details.debt"),
      value: formatUsd(position.metrics.totalBorrowedUsd, locale),
    },
    ...(healthFactor === null
      ? []
      : [
          {
            id: "health-factor",
            label: t("dashboard.borrow.position_details.health_factor"),
            value: formatHealthFactor(healthFactor, locale),
            tone: riskTone,
          },
        ]),
  ];
  // The summary's loan to value gauge marks the liquidation threshold; without
  // a loan to value there is no gauge, so the details carry it.
  const detailRows: BorrowPositionDetailRow[] = [
    ...(debtBalance
      ? [
          {
            id: "borrowed",
            label: t("dashboard.borrow.position_details.borrowed"),
            value: `${formatTokenAmount(debtBalance.balance, locale, "up")} ${debtBalance.tokenSymbol}`,
          },
        ]
      : []),
    {
      id: "borrow-apy",
      label: t("dashboard.borrow.details.borrow_apy"),
      value: formatPercent(position.metrics.borrowApy, locale),
    },
    {
      id: "market-type",
      label: t("dashboard.borrow.details.market_type"),
      value: t(`dashboard.borrow.market_type.${position.market.type}`),
    },
    {
      id: "max-ltv",
      label: t("dashboard.borrow.details.max_ltv"),
      value: formatPercent(maxLtv, locale),
    },
    ...(currentLtv === null
      ? [
          {
            id: "liquidation-threshold",
            label: t("dashboard.borrow.position_details.liquidation_threshold"),
            value: formatPercent(liquidationThreshold, locale),
          },
        ]
      : []),
    {
      id: "liquidation-penalty",
      label: t("dashboard.borrow.position_details.liquidation_penalty"),
      value: formatPercent(marketRisk.liquidationPenalty, locale),
    },
  ];
  const collateralItems = supplyBalances.map((balance) => {
    const collateralToken = position.market.collateralTokens.find(
      (candidate) => candidate.token.address === balance.tokenAddress
    );
    const collateralToggleAction = balance.pendingActions.find(
      (action) =>
        action.type === "enableCollateral" ||
        action.type === "disableCollateral"
    );

    return {
      balance: `${formatTokenAmount(balance.balance, locale, "down")} ${balance.tokenSymbol}`,
      balanceUsd: formatUsd(balance.balanceUsd, locale),
      collateralToggleAction:
        collateralToggleAction && collateralToken
          ? ({
              action: collateralToggleAction,
              collateralToken,
              supplyBalance: balance,
            } as const)
          : null,
      id: balance.tokenAddress,
      isCollateral: balance.isCollateral,
      label: balance.tokenSymbol,
      supplyRate: formatPercent(balance.apy, locale),
    };
  });

  return {
    collateralItems,
    currentLtv,
    detailRows,
    headerToken: borrowTokenToAppToken({
      network: position.market.network,
      token: overview.headerToken,
    }),
    healthFactor,
    liquidationThreshold,
    maxLtv,
    networkName: formatNetworkName(position.market.network),
    riskBand,
    riskAlert: getRiskAlert({ band: riskBand, healthFactor, locale, t }),
    providerName: formatBorrowProviderName(position.integration.name),
    summary: {
      value: formatUsd(position.metrics.netWorthUsd, locale),
      subvalue: t("dashboard.borrow.position_details.net_worth_caption", {
        collateral: formatUsd(position.metrics.totalCollateralUsd, locale),
      }),
      metrics: summaryMetrics,
    },
    title: overview.title,
  };
};

/** What a market position's page shows of it. */
export type BorrowPositionDetailsModel = ReturnType<
  typeof getBorrowPositionDetailsModel
>;
