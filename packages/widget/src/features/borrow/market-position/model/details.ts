import type { TFunction } from "i18next";
import { getBorrowMarketPairLabel } from "../../../../domain/borrow/catalog/market";
import {
  deriveMarketPositionOverview,
  type MarketPosition,
} from "../../../../domain/borrow/positions/market-position";
import { deriveMarketRiskLimits } from "../../../../domain/borrow/risk/market-risk";
import { borrowTokenToAppToken } from "../../../../shared/lib/borrow-token";
import {
  formatBorrowProviderName,
  formatHealthFactor,
  formatNetworkName,
  formatPercent,
  formatUsd,
} from "../../../../shared/lib/formatters";
import { formatNumber } from "../../../../shared/lib/number-format";
import type {
  BorrowPositionPendingActionContext,
  BorrowWithdrawTokenOption,
} from "../../action-preparation/model/action-context";

type BorrowPositionMetricCard = {
  readonly id: string;
  readonly label: string;
  readonly subValue?: string;
  readonly value: string;
};

type BorrowPositionRow = {
  readonly id: string;
  readonly label: string;
  readonly subValue?: string;
  readonly value: string;
};

type BorrowPositionDetailRow = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
};

export type BorrowPositionAction = {
  readonly id: string;
  readonly label: string;
  readonly pendingContext: BorrowPositionPendingActionContext;
  readonly type:
    | "disableCollateral"
    | "enableCollateral"
    | "repay"
    | "withdraw";
};

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
  position,
  t,
}: {
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
    currentRisk.status === "available" ? currentRisk.maxLtv : marketRisk.maxLtv;
  const liquidationThreshold =
    currentRisk.status === "available"
      ? currentRisk.liquidationThreshold
      : marketRisk.liquidationThreshold;
  const metricCards: BorrowPositionMetricCard[] = [
    {
      id: "net-worth",
      label: t("dashboard.borrow.position_details.net_worth"),
      value: formatUsd(position.metrics.netWorthUsd),
    },
    {
      id: "debt",
      label: t("dashboard.borrow.position_details.debt"),
      subValue: debtBalance?.tokenSymbol,
      value: formatUsd(position.metrics.totalBorrowedUsd),
    },
    {
      id: "ltv",
      label: t("dashboard.borrow.position_details.ltv"),
      value: formatPercent(currentLtv),
    },
    {
      id: "health-factor",
      label: t("dashboard.borrow.position_details.health_factor"),
      value: formatHealthFactor(healthFactor),
    },
  ];
  const breakdownRows: BorrowPositionRow[] = [
    ...supplyBalances.map((balance) => ({
      id: `supply-${balance.tokenAddress}`,
      label: balance.isCollateral
        ? t("dashboard.borrow.position_details.collateral")
        : t("dashboard.borrow.position_details.supplied"),
      subValue: formatUsd(balance.balanceUsd),
      value: `${formatNumber(balance.balance, 6)} ${balance.tokenSymbol}`,
    })),
    ...(debtBalance
      ? [
          {
            id: `debt-${debtBalance.tokenAddress}`,
            label: t("dashboard.borrow.position_details.borrowed"),
            subValue: formatUsd(debtBalance.balanceUsd),
            value: `${formatNumber(debtBalance.balance, 6)} ${debtBalance.tokenSymbol}`,
          },
        ]
      : []),
  ];
  const detailRows: BorrowPositionDetailRow[] = [
    {
      id: "provider",
      label: t("dashboard.borrow.details.provider"),
      value: formatBorrowProviderName(position.integration.name),
    },
    {
      id: "network",
      label: t("dashboard.borrow.details.network"),
      value: formatNetworkName(position.market.network),
    },
    {
      id: "market-type",
      label: t("dashboard.borrow.details.market_type"),
      value: t(`dashboard.borrow.market_type.${position.market.type}`),
    },
    {
      id: "max-ltv",
      label: t("dashboard.borrow.details.max_ltv"),
      value: formatPercent(maxLtv),
    },
    {
      id: "liquidation-threshold",
      label: t("dashboard.borrow.position_details.liquidation_threshold"),
      value: formatPercent(liquidationThreshold),
    },
    {
      id: "liquidation-penalty",
      label: t("dashboard.borrow.position_details.liquidation_penalty"),
      value: formatPercent(marketRisk.liquidationPenalty),
    },
    {
      id: "borrow-apy",
      label: t("dashboard.borrow.details.borrow_apy"),
      value: formatPercent(position.metrics.borrowApy),
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
      balance: `${formatNumber(balance.balance, 6)} ${balance.tokenSymbol}`,
      balanceUsd: formatUsd(balance.balanceUsd),
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
      supplyRate: formatPercent(balance.apy),
    };
  });

  return {
    breakdownRows,
    collateralItems,
    currentLtv,
    detailRows,
    headerToken: borrowTokenToAppToken({
      network: position.market.network,
      token: overview.headerToken,
    }),
    healthFactor,
    liquidationThreshold,
    marketLabel: getBorrowMarketPairLabel(position.market),
    metricCards,
    providerName: formatBorrowProviderName(position.integration.name),
    totalCollateralUsd: formatUsd(position.metrics.totalCollateralUsd),
    title: overview.title,
  };
};
