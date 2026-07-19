import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import {
  buildCollateralToggleActionRequest,
  buildRepayActionRequest,
  buildWithdrawActionRequest,
} from "../../../domain/borrow/action-request";
import type { BorrowNetwork } from "../../../domain/borrow/network";
import type { PendingAction } from "../../../domain/borrow/pending-action";
import type { Position, SupplyBalance } from "../../../domain/borrow/position";
import type { BorrowToken } from "../../../domain/borrow/token";
import type { WalletAddress } from "../../../domain/schema/identifiers";
import type { AppToken } from "../../../domain/schema/legacy-models";
import { formatCompactUsd } from "../../../shared/lib/formatters";
import { formatNumber } from "../../../shared/lib/number-format";
import type {
  BorrowPositionPendingActionContext,
  BorrowWithdrawTokenOption,
} from "../atoms/action-form";
import { getBorrowMarketPairLabel } from "./model";
import type { BorrowReviewState } from "./review-state";

type BorrowPositionMetricCard = {
  readonly id: string;
  readonly label: string;
  readonly subValue?: string;
  readonly value: ReactNode;
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
  readonly value: ReactNode;
};

export type BorrowPositionAction = {
  readonly id: string;
  readonly label: string;
  readonly pendingContext: BorrowPositionPendingActionContext;
  readonly reviewState: BorrowReviewState;
  readonly type:
    | "disableCollateral"
    | "enableCollateral"
    | "repay"
    | "withdraw";
};

const formatPercent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "-"
    : `${formatNumber(value * 100, 2)}%`;

const formatUsd = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "-"
    : formatCompactUsd(value.toString());

export const borrowTokenToTokenDto = ({
  network,
  token,
}: {
  readonly network: BorrowNetwork;
  readonly token: BorrowToken;
}): AppToken => ({
  address: token.address,
  decimals: token.decimals,
  name: token.name,
  network: network as AppToken["network"],
  symbol: token.symbol,
});

const getSupplyBalanceToken = ({
  position,
  supplyBalance,
}: {
  readonly position: Position;
  readonly supplyBalance: SupplyBalance | undefined;
}) => {
  if (!supplyBalance) {
    return position.market.loanToken;
  }

  return (
    position.market.collateralTokens.find(
      (collateralToken) =>
        collateralToken.token.address === supplyBalance.tokenAddress
    )?.token ?? {
      address: supplyBalance.tokenAddress,
      decimals: 18,
      name: supplyBalance.tokenSymbol,
      symbol: supplyBalance.tokenSymbol,
    }
  );
};

const getPositionHeaderToken = (position: Position) =>
  borrowTokenToTokenDto({
    network: position.market.network,
    token: position.debtBalance
      ? position.market.loanToken
      : getSupplyBalanceToken({
          position,
          supplyBalance: position.supplyBalances[0],
        }),
  });

const getPositionActionLabel = (action: PendingAction, t: TFunction) =>
  t(`dashboard.borrow.position_details.actions.${action.type}`);

const getPositionActionSummaryAction = (action: PendingAction) => action.type;

const getBorrowWithdrawTokenOptions = (
  position: Position
): BorrowWithdrawTokenOption[] =>
  position.supplyPendingActions.flatMap((action) => {
    if (action.type !== "withdraw") {
      return [];
    }

    const supplyBalance = position.supplyBalances.find(
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
  address,
  position,
  t,
}: {
  readonly address: WalletAddress;
  readonly position: Position;
  readonly t: TFunction;
}): BorrowPositionAction[] => {
  const marketLabel = getBorrowMarketPairLabel(position.market);
  const providerName = position.integration.name;
  const commonSummary = {
    marketLabel,
    network: position.market.network,
    providerName,
  };
  const actions: BorrowPositionAction[] = [];

  for (const action of position.debtPendingActions) {
    if (action.type !== "repay" || !position.debtBalance) {
      continue;
    }

    actions.push({
      id: `${action.type}-${action.args.tokenAddress}`,
      label: getPositionActionLabel(action, t),
      pendingContext: {
        action,
        debtBalance: position.debtBalance,
        position,
        type: "repay",
      },
      reviewState: {
        request: buildRepayActionRequest({
          address,
          integrationId: position.integration.id,
          marketId: action.args.marketId,
          repayAll: true,
          tokenAddress: action.args.tokenAddress,
        }),
        summary: {
          ...commonSummary,
          action: getPositionActionSummaryAction(action),
          borrowAmount: position.debtBalance.balance.toString(),
          loanTokenSymbol: position.debtBalance.tokenSymbol,
        },
      },
      type: "repay",
    });
  }

  const withdrawTokens = getBorrowWithdrawTokenOptions(position);
  const defaultWithdrawToken = withdrawTokens[0];
  if (defaultWithdrawToken) {
    actions.push({
      id: "withdraw",
      label: getPositionActionLabel(defaultWithdrawToken.action, t),
      pendingContext: {
        position,
        tokens: withdrawTokens,
        type: "withdraw",
      },
      reviewState: {
        request: buildWithdrawActionRequest({
          address,
          amount: defaultWithdrawToken.supplyBalance.balance,
          integrationId: position.integration.id,
          marketId: defaultWithdrawToken.action.args.marketId,
          tokenAddress: defaultWithdrawToken.action.args.tokenAddress,
        }),
        summary: {
          ...commonSummary,
          action: getPositionActionSummaryAction(defaultWithdrawToken.action),
          collateralAmount:
            defaultWithdrawToken.supplyBalance.balance.toString(),
          collateralTokenSymbol: defaultWithdrawToken.supplyBalance.tokenSymbol,
        },
      },
      type: "withdraw",
    });
  }

  for (const action of position.supplyPendingActions) {
    const supplyBalance = position.supplyBalances.find(
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
        label: getPositionActionLabel(action, t),
        pendingContext: {
          action,
          position,
          supplyBalance,
          type: action.type,
        },
        reviewState: {
          request: buildCollateralToggleActionRequest({
            action: action.type,
            address,
            integrationId: position.integration.id,
            marketId: action.args.marketId,
            tokenAddress: action.args.tokenAddress,
          }),
          summary: {
            ...commonSummary,
            action: getPositionActionSummaryAction(action),
            collateralTokenSymbol: supplyBalance.tokenSymbol,
          },
        },
        type: action.type,
      });
    }
  }

  return actions;
};

export const getBorrowPositionDetailsModel = ({
  position,
  t,
}: {
  readonly position: Position;
  readonly t: TFunction;
}) => {
  const meta = position.getMeta();
  const currentLtv = position.getCurrentLtv();
  const healthFactor = position.getHealthFactor();
  const collateralDetails = position.getCollateralTokenDetails();
  const metricCards: BorrowPositionMetricCard[] = [
    {
      id: "net-worth",
      label: t("dashboard.borrow.position_details.net_worth"),
      value: formatUsd(position.getNetWorthUsd()),
    },
    {
      id: "debt",
      label: t("dashboard.borrow.position_details.debt"),
      subValue: position.debtBalance?.tokenSymbol,
      value: formatUsd(position.getTotalBorrowedUsd()),
    },
    {
      id: "ltv",
      label: t("dashboard.borrow.position_details.ltv"),
      value: formatPercent(currentLtv),
    },
    {
      id: "health-factor",
      label: t("dashboard.borrow.position_details.health_factor"),
      value: healthFactor == null ? "-" : formatNumber(healthFactor, 2),
    },
  ];
  const breakdownRows: BorrowPositionRow[] = [
    ...position.supplyBalances.map((balance) => ({
      id: `supply-${balance.tokenAddress}`,
      label: balance.isCollateral
        ? t("dashboard.borrow.position_details.collateral")
        : t("dashboard.borrow.position_details.supplied"),
      subValue: formatUsd(balance.balanceUsd),
      value: `${formatNumber(balance.balance, 6)} ${balance.tokenSymbol}`,
    })),
    ...(position.debtBalance
      ? [
          {
            id: `debt-${position.debtBalance.tokenAddress}`,
            label: t("dashboard.borrow.position_details.borrowed"),
            subValue: formatUsd(position.debtBalance.balanceUsd),
            value: `${formatNumber(position.debtBalance.balance, 6)} ${
              position.debtBalance.tokenSymbol
            }`,
          },
        ]
      : []),
  ];
  const detailRows: BorrowPositionDetailRow[] = [
    {
      id: "provider",
      label: t("dashboard.borrow.details.provider"),
      value: position.integration.name,
    },
    {
      id: "network",
      label: t("dashboard.borrow.details.network"),
      value: position.market.network,
    },
    {
      id: "market-type",
      label: t("dashboard.borrow.details.market_type"),
      value: t(`dashboard.borrow.market_type.${position.market.type}`),
    },
    {
      id: "max-ltv",
      label: t("dashboard.borrow.details.max_ltv"),
      value: formatPercent(
        Number.isFinite(collateralDetails.maxLtv)
          ? collateralDetails.maxLtv
          : position.market.getMaxLtv()
      ),
    },
    {
      id: "liquidation-threshold",
      label: t("dashboard.borrow.position_details.liquidation_threshold"),
      value: formatPercent(
        Number.isFinite(collateralDetails.liquidationThreshold)
          ? collateralDetails.liquidationThreshold
          : position.market.getLiquidationThreshold()
      ),
    },
    {
      id: "liquidation-penalty",
      label: t("dashboard.borrow.position_details.liquidation_penalty"),
      value: formatPercent(
        Number.isFinite(collateralDetails.liquidationPenalty)
          ? collateralDetails.liquidationPenalty
          : position.market.getLiquidationPenalty()
      ),
    },
    {
      id: "net-apy",
      label: t("dashboard.borrow.position_details.net_apy"),
      value: formatPercent(position.getNetApy()),
    },
  ];
  const collateralItems = position.supplyBalances.map((balance) => {
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
  const liquidationThreshold = Number.isFinite(
    collateralDetails.liquidationThreshold
  )
    ? collateralDetails.liquidationThreshold
    : position.market.getLiquidationThreshold();

  return {
    breakdownRows,
    collateralItems,
    currentLtv,
    detailRows,
    headerToken: getPositionHeaderToken(position),
    healthFactor,
    liquidationThreshold,
    marketLabel: getBorrowMarketPairLabel(position.market),
    metricCards,
    providerName: position.integration.name,
    totalCollateralUsd: formatUsd(position.getTotalCollateralUsd()),
    title: meta.name,
  };
};
