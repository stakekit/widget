import type BigNumber from "bignumber.js";
import type { CollateralToken } from "../../../../domain/borrow/catalog/collateral-token";
import type { Integration } from "../../../../domain/borrow/catalog/integration";
import type { Market } from "../../../../domain/borrow/catalog/market";
import type {
  IntegrationId,
  MarketId,
  TokenAddress,
} from "../../../../domain/borrow/ids";
import type { BorrowNetwork } from "../../../../domain/borrow/network";
import type { BorrowPositions } from "../../../../domain/borrow/positions/borrow-positions";
import type { TokenBalance } from "../../../../domain/finance/models";
import type { WalletAddress } from "../../../../domain/identity/identifiers";
import type { BorrowTransactionFlowReview } from "../../../borrow-transaction-flow/index";
import type {
  BorrowCollateralToggleActionContext,
  BorrowRepayActionContext,
  BorrowWithdrawActionContext,
  BorrowWithdrawTokenOption,
} from "./action-context";

export type BorrowActionBlockReason =
  | "AmountExceedsAvailableLiquidity"
  | "AmountExceedsPositionBalance"
  | "AmountExceedsWalletBalance"
  | "ProjectedDebtBelowMarketMinimum"
  | "RemainingDebtBelowMarketMinimum"
  | "RiskCapacityExceeded";

export type BorrowRiskProjection =
  | {
      readonly currentLtv: BigNumber | null;
      readonly maxLtv: BigNumber | null;
      readonly projectedHealthFactor: BigNumber | null;
      readonly projectedLtv: BigNumber;
      readonly status: "available";
    }
  | {
      readonly currentLtv: BigNumber | null;
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

export type OpenPositionDraft = {
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

export type RepayDraft = {
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

export type WithdrawDraft = {
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

export type CollateralToggleIntent = {
  readonly _tag: "CollateralToggleIntent";
  readonly address: WalletAddress;
  readonly context: BorrowCollateralToggleActionContext;
};

export type PreparedActionCommonFacts = {
  readonly address: WalletAddress;
  readonly integrationId: IntegrationId;
  readonly marketId: MarketId;
  readonly marketLabel: string;
  readonly network: BorrowNetwork;
  readonly providerName: string;
  readonly risk: BorrowRiskProjection;
};

export type OpenPositionFinancialFacts = {
  readonly existingCollateralUsd: BigNumber;
  readonly existingDebtUsd: BigNumber;
  readonly projectedCollateralUsd: BigNumber;
  readonly projectedDebtUsd: BigNumber;
};

export type PreparedActionFacts = PreparedActionCommonFacts &
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
        readonly collateralFeeAmount: BigNumber;
        readonly collateralTokenAddress: TokenAddress | undefined;
        readonly collateralTokenSymbol: string;
        readonly effectiveCollateralAmount: BigNumber;
        readonly loanTokenAddress: TokenAddress | undefined;
        readonly loanTokenSymbol: string;
      })
    | (OpenPositionFinancialFacts & {
        readonly _tag: "Supply";
        readonly amount: BigNumber;
        readonly collateralFeeAmount: BigNumber;
        readonly collateralTokenAddress: TokenAddress | undefined;
        readonly collateralTokenSymbol: string;
        readonly effectiveCollateralAmount: BigNumber;
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
