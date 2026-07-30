import BigNumber from "bignumber.js";
import type { BorrowPositions } from "../../../domain/borrow/borrow-positions";
import type { CollateralToken } from "../../../domain/borrow/collateral-token";
import {
  decodeTokenId,
  type IntegrationId,
  type MarketId,
  type TokenAddress,
} from "../../../domain/borrow/ids";
import type { Integration } from "../../../domain/borrow/integration";
import type { Market } from "../../../domain/borrow/market";
import { isDebtBelowMarketMinimum } from "../../../domain/borrow/minimum-debt";
import type { BorrowNetwork } from "../../../domain/borrow/network";
import type { RiskPosition } from "../../../domain/borrow/risk-position";
import type { TokenBalance } from "../../../domain/schema/financial-models";
import type { WalletAddress } from "../../../domain/schema/identifiers";
import type { BorrowTransactionFlowReview } from "../../borrow-transaction-flow/state";
import type {
  BorrowCollateralToggleActionContext,
  BorrowRepayActionContext,
  BorrowWithdrawActionContext,
  BorrowWithdrawTokenOption,
} from "./position-action-context";
import {
  deriveBorrowMarketWalletBalances,
  deriveBorrowTokenWalletBalance,
} from "./wallet-balances";

export type BorrowActionBlockReason =
  | "AmountExceedsAvailableLiquidity"
  | "AmountExceedsPositionBalance"
  | "AmountExceedsWalletBalance"
  | "ProjectedDebtBelowMarketMinimum"
  | "RemainingDebtBelowMarketMinimum"
  | "RiskCapacityExceeded";

type BorrowRiskProjection =
  | {
      readonly currentLtv: number | null;
      readonly maxLtv: number | null;
      readonly projectedHealthFactor: number | null;
      readonly projectedLtv: number;
      readonly status: "available";
    }
  | {
      readonly currentLtv: number | null;
      readonly status: "unavailable";
    };

export type OpenPositionProjection = {
  readonly _tag: "OpenPosition";
  readonly borrowMaxAmount: BigNumber;
  readonly borrowUsd: BigNumber;
  readonly collateralMaxAmount: BigNumber;
  readonly collateralUsd: BigNumber;
  readonly financials: {
    readonly existingCollateralUsd: BigNumber;
    readonly existingDebtUsd: BigNumber;
    readonly projectedCollateralUsd: BigNumber;
    readonly projectedDebtUsd: BigNumber;
  };
  readonly risk: BorrowRiskProjection;
};

type OpenPositionDraft = {
  readonly _tag: "OpenPositionDraft";
  readonly address: WalletAddress;
  readonly borrowAmount: BigNumber;
  readonly collateralAmount: BigNumber;
  readonly collateralToken: CollateralToken;
  readonly integrations: ReadonlyArray<Integration>;
  readonly market: Market;
  readonly positions: BorrowPositions;
  readonly tokenBalances: ReadonlyArray<TokenBalance>;
};

export type RepayProjection = {
  readonly _tag: "Repay";
  readonly amount: BigNumber;
  readonly effectiveAmount: BigNumber;
  readonly financials: {
    readonly existingDebtUsd: BigNumber;
    readonly projectedDebtUsd: BigNumber;
  };
  readonly remainingDebt: BigNumber;
  readonly repayAll: boolean;
  readonly repayUsd: BigNumber;
  readonly risk: BorrowRiskProjection;
};

type RepayDraft = {
  readonly _tag: "RepayDraft";
  readonly address: WalletAddress;
  readonly amount: BigNumber;
  readonly context: BorrowRepayActionContext;
  readonly repayAll: boolean;
  readonly tokenBalances: ReadonlyArray<TokenBalance> | null;
};

export type WithdrawProjection = {
  readonly _tag: "Withdraw";
  readonly amount: BigNumber;
  readonly financials: {
    readonly existingCollateralUsd: BigNumber;
    readonly projectedCollateralUsd: BigNumber;
  };
  readonly risk: BorrowRiskProjection;
  readonly withdrawUsd: BigNumber;
};

type WithdrawDraft = {
  readonly _tag: "WithdrawDraft";
  readonly address: WalletAddress;
  readonly amount: BigNumber;
  readonly context: BorrowWithdrawActionContext;
  readonly token: BorrowWithdrawTokenOption;
};

export type CollateralToggleProjection = {
  readonly _tag: "CollateralToggle";
  readonly financials: {
    readonly existingCollateralUsd: BigNumber;
  };
  readonly risk: BorrowRiskProjection;
};

type CollateralToggleIntent = {
  readonly _tag: "CollateralToggleIntent";
  readonly address: WalletAddress;
  readonly context: BorrowCollateralToggleActionContext;
};

type PreparedActionCommonFacts = {
  readonly address: WalletAddress;
  readonly integrationId: IntegrationId;
  readonly marketId: MarketId;
  readonly marketLabel: string;
  readonly network: BorrowNetwork;
  readonly providerName: string;
  readonly risk: BorrowRiskProjection;
};

type OpenPositionFinancialFacts = {
  readonly existingCollateralUsd: BigNumber;
  readonly existingDebtUsd: BigNumber;
  readonly projectedCollateralUsd: BigNumber;
  readonly projectedDebtUsd: BigNumber;
};

type PreparedActionFacts = PreparedActionCommonFacts &
  (
    | (OpenPositionFinancialFacts & {
        readonly _tag: "Borrow";
        readonly amount: BigNumber;
        readonly loanTokenAddress: TokenAddress | undefined;
        readonly loanTokenSymbol: string;
      })
    | (OpenPositionFinancialFacts & {
        readonly _tag: "BorrowAndSupply";
        readonly borrowAmount: BigNumber;
        readonly collateralAmount: BigNumber;
        readonly collateralTokenAddress: TokenAddress | undefined;
        readonly collateralTokenSymbol: string;
        readonly loanTokenAddress: TokenAddress | undefined;
        readonly loanTokenSymbol: string;
      })
    | (OpenPositionFinancialFacts & {
        readonly _tag: "Supply";
        readonly amount: BigNumber;
        readonly collateralTokenAddress: TokenAddress | undefined;
        readonly collateralTokenSymbol: string;
      })
    | {
        readonly _tag: "Repay";
        readonly amount: BigNumber;
        readonly existingDebtUsd: BigNumber;
        readonly loanTokenAddress: TokenAddress;
        readonly loanTokenSymbol: string;
        readonly projectedDebtUsd: BigNumber;
        readonly repayAll: boolean;
      }
    | {
        readonly _tag: "Withdraw";
        readonly amount: BigNumber;
        readonly collateralTokenAddress: TokenAddress;
        readonly collateralTokenSymbol: string;
        readonly existingCollateralUsd: BigNumber;
        readonly projectedCollateralUsd: BigNumber;
      }
    | {
        readonly _tag: "DisableCollateral" | "EnableCollateral";
        readonly collateralTokenAddress: TokenAddress;
        readonly collateralTokenSymbol: string;
        readonly existingCollateralUsd: BigNumber;
      }
  );

const makeOpenPositionFacts = ({
  borrowAmount,
  collateralAmount,
  collateralToken,
  common,
  market,
}: {
  readonly borrowAmount: BigNumber;
  readonly collateralAmount: BigNumber;
  readonly collateralToken: CollateralToken;
  readonly common: PreparedActionCommonFacts & OpenPositionFinancialFacts;
  readonly market: Market;
}): PreparedActionFacts => {
  if (borrowAmount.gt(0) && collateralAmount.gt(0)) {
    return {
      ...common,
      _tag: "BorrowAndSupply",
      borrowAmount,
      collateralAmount,
      collateralTokenAddress: collateralToken.token.address,
      collateralTokenSymbol: collateralToken.token.symbol,
      loanTokenAddress: market.loanToken.address,
      loanTokenSymbol: market.loanToken.symbol,
    };
  }

  if (borrowAmount.gt(0)) {
    return {
      ...common,
      _tag: "Borrow",
      amount: borrowAmount,
      loanTokenAddress: market.loanToken.address,
      loanTokenSymbol: market.loanToken.symbol,
    };
  }

  return {
    ...common,
    _tag: "Supply",
    amount: collateralAmount,
    collateralTokenAddress: collateralToken.token.address,
    collateralTokenSymbol: collateralToken.token.symbol,
  };
};

type IdleBorrowActionPreparation<P> = {
  readonly _tag: "Idle";
  readonly projection: P;
};

type BlockedBorrowActionPreparation<P> = {
  readonly _tag: "Blocked";
  readonly projection: P;
  readonly reasons: readonly [
    BorrowActionBlockReason,
    ...ReadonlyArray<BorrowActionBlockReason>,
  ];
};

type ReadyBorrowActionPreparation<P> = {
  readonly _tag: "Ready";
  readonly projection: P;
  readonly review: BorrowTransactionFlowReview;
};

export type BorrowActionPreparation<P> =
  | IdleBorrowActionPreparation<P>
  | BlockedBorrowActionPreparation<P>
  | ReadyBorrowActionPreparation<P>;

const optionalTokenAddress = (tokenAddress: TokenAddress | undefined) =>
  tokenAddress ? { tokenAddress } : {};

const optionalCollateralTokenAddress = (
  collateralTokenAddress: TokenAddress | undefined
) => (collateralTokenAddress ? { collateralTokenAddress } : {});

const getMarketPairLabel = (market: Market) => {
  const collateralToken = market.collateralTokens[0];

  return collateralToken
    ? `${collateralToken.token.symbol} / ${market.loanToken.symbol}`
    : market.loanToken.symbol;
};

const getRiskSummary = (
  risk: BorrowRiskProjection
):
  | {
      readonly projectedHealthFactor?: string;
      readonly projectedLtv: string;
      readonly riskStatus: "available";
    }
  | { readonly riskStatus: "unavailable" } => {
  if (risk.status === "unavailable") {
    return { riskStatus: risk.status };
  }

  return {
    ...(risk.projectedHealthFactor == null
      ? {}
      : { projectedHealthFactor: risk.projectedHealthFactor.toString() }),
    projectedLtv: risk.projectedLtv.toString(),
    riskStatus: risk.status,
  };
};

const toBorrowTransactionFlowReview = (
  facts: PreparedActionFacts
): BorrowTransactionFlowReview => {
  const commonSummary = {
    marketLabel: facts.marketLabel,
    network: facts.network,
    providerName: facts.providerName,
    ...getRiskSummary(facts.risk),
  };

  switch (facts._tag) {
    case "Borrow":
      return {
        command: {
          action: "borrow",
          address: facts.address,
          args: {
            amount: facts.amount.toString(10),
            marketId: facts.marketId,
            ...optionalTokenAddress(facts.loanTokenAddress),
          },
          integrationId: facts.integrationId,
        },
        summary: {
          ...commonSummary,
          action: "borrow",
          borrowAmount: facts.amount.toString(10),
          existingCollateralUsd: facts.existingCollateralUsd.toString(10),
          existingDebtUsd: facts.existingDebtUsd.toString(10),
          loanTokenSymbol: facts.loanTokenSymbol,
          projectedCollateralUsd: facts.projectedCollateralUsd.toString(10),
          projectedDebtUsd: facts.projectedDebtUsd.toString(10),
        },
      };
    case "BorrowAndSupply":
      return {
        command: {
          action: "borrow",
          address: facts.address,
          args: {
            amount: facts.borrowAmount.toString(10),
            collateralAmount: facts.collateralAmount.toString(10),
            marketId: facts.marketId,
            ...optionalTokenAddress(facts.loanTokenAddress),
            ...optionalCollateralTokenAddress(facts.collateralTokenAddress),
          },
          integrationId: facts.integrationId,
        },
        summary: {
          ...commonSummary,
          action: "borrowAndSupply",
          borrowAmount: facts.borrowAmount.toString(10),
          collateralAmount: facts.collateralAmount.toString(10),
          collateralTokenSymbol: facts.collateralTokenSymbol,
          existingCollateralUsd: facts.existingCollateralUsd.toString(10),
          existingDebtUsd: facts.existingDebtUsd.toString(10),
          loanTokenSymbol: facts.loanTokenSymbol,
          projectedCollateralUsd: facts.projectedCollateralUsd.toString(10),
          projectedDebtUsd: facts.projectedDebtUsd.toString(10),
        },
      };
    case "Supply":
      return {
        command: {
          action: "supply",
          address: facts.address,
          args: {
            amount: facts.amount.toString(10),
            marketId: facts.marketId,
            ...optionalTokenAddress(facts.collateralTokenAddress),
          },
          integrationId: facts.integrationId,
        },
        summary: {
          ...commonSummary,
          action: "supply",
          collateralAmount: facts.amount.toString(10),
          collateralTokenSymbol: facts.collateralTokenSymbol,
          existingCollateralUsd: facts.existingCollateralUsd.toString(10),
          existingDebtUsd: facts.existingDebtUsd.toString(10),
          projectedCollateralUsd: facts.projectedCollateralUsd.toString(10),
          projectedDebtUsd: facts.projectedDebtUsd.toString(10),
        },
      };
    case "Repay":
      return {
        command: {
          action: "repay",
          address: facts.address,
          args: {
            marketId: facts.marketId,
            ...(facts.repayAll
              ? { repayAll: true as const }
              : { amount: facts.amount.toString(10) }),
            tokenAddress: facts.loanTokenAddress,
          },
          integrationId: facts.integrationId,
        },
        summary: {
          ...commonSummary,
          action: "repay",
          borrowAmount: facts.amount.toString(10),
          existingDebtUsd: facts.existingDebtUsd.toString(10),
          loanTokenSymbol: facts.loanTokenSymbol,
          projectedDebtUsd: facts.projectedDebtUsd.toString(10),
        },
      };
    case "Withdraw":
      return {
        command: {
          action: "withdraw",
          address: facts.address,
          args: {
            amount: facts.amount.toString(10),
            marketId: facts.marketId,
            tokenAddress: facts.collateralTokenAddress,
          },
          integrationId: facts.integrationId,
        },
        summary: {
          ...commonSummary,
          action: "withdraw",
          collateralAmount: facts.amount.toString(10),
          collateralTokenSymbol: facts.collateralTokenSymbol,
          existingCollateralUsd: facts.existingCollateralUsd.toString(10),
          projectedCollateralUsd: facts.projectedCollateralUsd.toString(10),
        },
      };
    case "DisableCollateral":
    case "EnableCollateral": {
      const action =
        facts._tag === "DisableCollateral"
          ? ("disableCollateral" as const)
          : ("enableCollateral" as const);

      return {
        command: {
          action,
          address: facts.address,
          args: {
            marketId: facts.marketId,
            tokenAddress: facts.collateralTokenAddress,
          },
          integrationId: facts.integrationId,
        },
        summary: {
          ...commonSummary,
          action,
          collateralTokenSymbol: facts.collateralTokenSymbol,
          existingCollateralUsd: facts.existingCollateralUsd.toString(10),
        },
      };
    }
  }
};

type DomainRiskProjection = ReturnType<RiskPosition["assess"]>["projection"];

const toBorrowRiskProjection = ({
  current,
  projected,
}: {
  readonly current: RiskPosition["current"];
  readonly projected: DomainRiskProjection;
}): BorrowRiskProjection => {
  if (projected.status === "unavailable") {
    return {
      currentLtv: current.status === "available" ? current.ltv : null,
      status: "unavailable",
    };
  }

  return {
    currentLtv: current.status === "available" ? current.ltv : null,
    maxLtv: projected.maxLtv,
    projectedHealthFactor: projected.healthFactor,
    projectedLtv: projected.ltv,
    status: "available",
  };
};

const prepareOpenPositionAction = (
  input: OpenPositionDraft
): BorrowActionPreparation<OpenPositionProjection> => {
  const {
    address,
    borrowAmount,
    collateralAmount,
    collateralToken,
    integrations,
    market,
    positions,
    tokenBalances,
  } = input;
  const marketPosition =
    positions.items.find((position) => position.id === market.id) ?? null;
  const riskPosition = positions.riskFor(market);
  const walletBalances = deriveBorrowMarketWalletBalances({
    balances: tokenBalances,
    market,
    selectedCollateralTokenAddress: collateralToken.token.address,
  });
  const borrowMaxAmount = new BigNumber(market.availableLiquidity);
  const collateralMaxAmount =
    walletBalances.selectedCollateralToken?.amountValue ?? new BigNumber(0);
  const borrowUsd = borrowAmount.multipliedBy(market.loanTokenPriceUsd);
  const collateralUsd = collateralAmount.multipliedBy(collateralToken.priceUsd);
  const changes = [
    ...(borrowAmount.gt(0)
      ? [
          {
            amount: borrowAmount.toNumber(),
            marketId: market.id,
            type: "borrow" as const,
          },
        ]
      : []),
    ...(collateralAmount.gt(0)
      ? [
          {
            amount: collateralAmount.toNumber(),
            tokenId: decodeTokenId({
              address: collateralToken.token.address,
              symbol: collateralToken.token.symbol,
            }),
            type: "supply" as const,
          },
        ]
      : []),
  ];
  const assessment = riskPosition.assess(changes);
  const current = riskPosition.current;
  const existingCollateralUsd = new BigNumber(current.totalCollateralUsd ?? 0);
  const existingDebtUsd = new BigNumber(current.totalDebtUsd ?? 0);
  const projectedCollateralUsd = new BigNumber(
    assessment.projection.totalCollateralUsd ??
      existingCollateralUsd.plus(collateralUsd)
  );
  const projectedDebtUsd = new BigNumber(
    assessment.projection.totalDebtUsd ?? existingDebtUsd.plus(borrowUsd)
  );
  const risk = toBorrowRiskProjection({
    current,
    projected: assessment.projection,
  });
  const projection: OpenPositionProjection = {
    _tag: "OpenPosition",
    borrowMaxAmount,
    borrowUsd,
    collateralMaxAmount,
    collateralUsd,
    financials: {
      existingCollateralUsd,
      existingDebtUsd,
      projectedCollateralUsd,
      projectedDebtUsd,
    },
    risk,
  };
  const hasBorrow = borrowAmount.gt(0);
  const hasCollateral = collateralAmount.gt(0);

  if (!hasBorrow && !hasCollateral) {
    return { _tag: "Idle", projection };
  }

  const reasons: BorrowActionBlockReason[] = [];
  if (borrowAmount.gt(borrowMaxAmount)) {
    reasons.push("AmountExceedsAvailableLiquidity");
  }
  if (collateralAmount.gt(collateralMaxAmount)) {
    reasons.push("AmountExceedsWalletBalance");
  }
  if (assessment.decision === "block") {
    reasons.push("RiskCapacityExceeded");
  }
  const existingDebtAmount = new BigNumber(
    marketPosition?.balances.debt?.balance ?? 0
  );
  const projectedDebtAmount = existingDebtAmount.plus(borrowAmount);
  if (
    hasBorrow &&
    isDebtBelowMarketMinimum({
      debt: projectedDebtAmount,
      minimum: new BigNumber(market.minLoan ?? 0),
    })
  ) {
    reasons.push("ProjectedDebtBelowMarketMinimum");
  }

  if (reasons.length > 0) {
    return {
      _tag: "Blocked",
      projection,
      reasons: reasons as [
        BorrowActionBlockReason,
        ...BorrowActionBlockReason[],
      ],
    };
  }

  const integration = integrations.find(
    (candidate) => candidate.id === market.integrationId
  );
  const commonFacts = {
    address,
    existingCollateralUsd,
    existingDebtUsd,
    integrationId: market.integrationId,
    marketId: market.id,
    marketLabel: `${collateralToken.token.symbol} / ${market.loanToken.symbol}`,
    network: market.network,
    projectedCollateralUsd,
    projectedDebtUsd,
    providerName: integration?.name ?? market.integrationId,
    risk,
  } satisfies PreparedActionCommonFacts & OpenPositionFinancialFacts;
  const facts = makeOpenPositionFacts({
    borrowAmount,
    collateralAmount,
    collateralToken,
    common: commonFacts,
    market,
  });

  return {
    _tag: "Ready",
    projection,
    review: toBorrowTransactionFlowReview(facts),
  };
};

const prepareRepayAction = (
  input: RepayDraft
): BorrowActionPreparation<RepayProjection> => {
  const { address, amount, context, repayAll, tokenBalances } = input;
  const { action, debtBalance, position } = context;
  const effectiveAmount = repayAll
    ? new BigNumber(debtBalance.balance)
    : amount;
  const walletBalance = deriveBorrowTokenWalletBalance({
    balances: tokenBalances ?? [],
    network: position.market.network,
    token: position.market.loanToken,
  });
  const repayUsd = effectiveAmount.multipliedBy(
    position.market.loanTokenPriceUsd
  );
  const remainingDebt = BigNumber.maximum(
    new BigNumber(debtBalance.balance).minus(effectiveAmount),
    0
  );
  const assessment = position.risk.assess([
    {
      amount: effectiveAmount.toNumber(),
      marketId: action.args.marketId,
      type: "repay",
    },
  ]);
  const projectedDebtUsd = new BigNumber(
    assessment.projection.totalDebtUsd ??
      Math.max(position.metrics.totalBorrowedUsd - repayUsd.toNumber(), 0)
  );
  const risk = toBorrowRiskProjection({
    current: position.risk.current,
    projected: assessment.projection,
  });
  const projection: RepayProjection = {
    _tag: "Repay",
    amount,
    effectiveAmount,
    financials: {
      existingDebtUsd: new BigNumber(debtBalance.balanceUsd),
      projectedDebtUsd,
    },
    remainingDebt,
    repayAll,
    repayUsd,
    risk,
  };

  if (!repayAll && !effectiveAmount.gt(0)) {
    return { _tag: "Idle", projection };
  }

  const reasons: BorrowActionBlockReason[] = [];
  if (effectiveAmount.gt(debtBalance.balance)) {
    reasons.push("AmountExceedsPositionBalance");
  }
  if (tokenBalances && effectiveAmount.gt(walletBalance.amountValue)) {
    reasons.push("AmountExceedsWalletBalance");
  }
  if (
    isDebtBelowMarketMinimum({
      debt: remainingDebt,
      minimum: new BigNumber(position.market.minLoan ?? 0),
    })
  ) {
    reasons.push("RemainingDebtBelowMarketMinimum");
  }

  if (reasons.length > 0) {
    return {
      _tag: "Blocked",
      projection,
      reasons: reasons as [
        BorrowActionBlockReason,
        ...BorrowActionBlockReason[],
      ],
    };
  }

  const facts: PreparedActionFacts = {
    _tag: "Repay",
    address,
    amount: effectiveAmount,
    existingDebtUsd: new BigNumber(debtBalance.balanceUsd),
    integrationId: position.integration.id,
    loanTokenAddress: action.args.tokenAddress,
    loanTokenSymbol: debtBalance.tokenSymbol,
    marketId: action.args.marketId,
    marketLabel: getMarketPairLabel(position.market),
    network: position.market.network,
    projectedDebtUsd,
    providerName: position.integration.name,
    repayAll,
    risk,
  };

  return {
    _tag: "Ready",
    projection,
    review: toBorrowTransactionFlowReview(facts),
  };
};

const prepareWithdrawAction = (
  input: WithdrawDraft
): BorrowActionPreparation<WithdrawProjection> => {
  const { address, amount, context, token } = input;
  const { position } = context;
  const withdrawUsd = amount.multipliedBy(token.collateralToken.priceUsd);
  const currentCollateralUsd = new BigNumber(
    position.risk.current.totalCollateralUsd ??
      position.metrics.totalCollateralUsd
  );
  const assessment = position.risk.assess([
    {
      amount: amount.toNumber(),
      tokenId: decodeTokenId({
        address: token.collateralToken.token.address,
        symbol: token.collateralToken.token.symbol,
      }),
      type: "withdraw",
    },
  ]);
  const projectedCollateralUsd = new BigNumber(
    assessment.projection.totalCollateralUsd ??
      BigNumber.maximum(currentCollateralUsd.minus(withdrawUsd), 0)
  );
  const risk = toBorrowRiskProjection({
    current: position.risk.current,
    projected: assessment.projection,
  });
  const projection: WithdrawProjection = {
    _tag: "Withdraw",
    amount,
    financials: {
      existingCollateralUsd: currentCollateralUsd,
      projectedCollateralUsd,
    },
    risk,
    withdrawUsd,
  };

  if (!amount.gt(0)) {
    return { _tag: "Idle", projection };
  }

  const reasons: BorrowActionBlockReason[] = [];
  if (amount.gt(token.supplyBalance.balance)) {
    reasons.push("AmountExceedsPositionBalance");
  }
  if (assessment.decision === "block") {
    reasons.push("RiskCapacityExceeded");
  }

  if (reasons.length > 0) {
    return {
      _tag: "Blocked",
      projection,
      reasons: reasons as [
        BorrowActionBlockReason,
        ...BorrowActionBlockReason[],
      ],
    };
  }

  return {
    _tag: "Ready",
    projection,
    review: toBorrowTransactionFlowReview({
      _tag: "Withdraw",
      address,
      amount,
      collateralTokenAddress: token.action.args.tokenAddress,
      collateralTokenSymbol: token.supplyBalance.tokenSymbol,
      existingCollateralUsd: currentCollateralUsd,
      integrationId: position.integration.id,
      marketId: token.action.args.marketId,
      marketLabel: getMarketPairLabel(position.market),
      network: position.market.network,
      projectedCollateralUsd,
      providerName: position.integration.name,
      risk,
    }),
  };
};

const prepareCollateralToggleAction = (
  input: CollateralToggleIntent
): BorrowActionPreparation<CollateralToggleProjection> => {
  const { address, context } = input;
  const { action, position, supplyBalance } = context;
  const assessment = position.risk.assess([
    {
      tokenId: decodeTokenId({
        address: action.args.tokenAddress,
        symbol: supplyBalance.tokenSymbol,
      }),
      type: context.type,
    },
  ]);
  const existingCollateralUsd = new BigNumber(
    position.risk.current.totalCollateralUsd ??
      position.metrics.totalCollateralUsd
  );
  const risk = toBorrowRiskProjection({
    current: position.risk.current,
    projected: assessment.projection,
  });
  const projection: CollateralToggleProjection = {
    _tag: "CollateralToggle",
    financials: { existingCollateralUsd },
    risk,
  };

  if (assessment.decision === "block") {
    return {
      _tag: "Blocked",
      projection,
      reasons: ["RiskCapacityExceeded"],
    };
  }

  return {
    _tag: "Ready",
    projection,
    review: toBorrowTransactionFlowReview({
      _tag:
        context.type === "disableCollateral"
          ? "DisableCollateral"
          : "EnableCollateral",
      address,
      collateralTokenAddress: action.args.tokenAddress,
      collateralTokenSymbol: supplyBalance.tokenSymbol,
      existingCollateralUsd,
      integrationId: position.integration.id,
      marketId: action.args.marketId,
      marketLabel: getMarketPairLabel(position.market),
      network: position.market.network,
      providerName: position.integration.name,
      risk,
    }),
  };
};

export function prepareBorrowAction(
  input: OpenPositionDraft
): BorrowActionPreparation<OpenPositionProjection>;
export function prepareBorrowAction(
  input: RepayDraft
): BorrowActionPreparation<RepayProjection>;
export function prepareBorrowAction(
  input: WithdrawDraft
): BorrowActionPreparation<WithdrawProjection>;
export function prepareBorrowAction(
  input: CollateralToggleIntent
): BorrowActionPreparation<CollateralToggleProjection>;
export function prepareBorrowAction(
  input: CollateralToggleIntent | OpenPositionDraft | RepayDraft | WithdrawDraft
):
  | BorrowActionPreparation<CollateralToggleProjection>
  | BorrowActionPreparation<OpenPositionProjection>
  | BorrowActionPreparation<RepayProjection>
  | BorrowActionPreparation<WithdrawProjection> {
  switch (input._tag) {
    case "CollateralToggleIntent":
      return prepareCollateralToggleAction(input);
    case "OpenPositionDraft":
      return prepareOpenPositionAction(input);
    case "RepayDraft":
      return prepareRepayAction(input);
    case "WithdrawDraft":
      return prepareWithdrawAction(input);
  }
}
