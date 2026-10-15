import { Schema, Struct } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";
import { ExactBaseUnitAmount, ExactDecimal } from "../../finance/scalars";
import { IntegrationId, MarketId, TokenAddress, WalletAddress } from "../ids";
import { BorrowNetwork } from "../network";
import { NonNegativeRiskValue, RiskRatio } from "../risk/risk-values";
import { PendingActions } from "./pending-action";

export const IsolatedRiskSnapshot = Schema.Struct({
  availableToBorrowUsd: NonNegativeRiskValue,
  currentLtv: NonNegativeRiskValue,
  healthFactor: Schema.NullOr(NonNegativeRiskValue),
  liquidationThreshold: RiskRatio,
});
export type IsolatedRiskSnapshot = typeof IsolatedRiskSnapshot.Type;

export const SupplyBalance = Schema.Struct({
  ...Struct.pick(BorrowApi.SupplyBalanceDto.fields, [
    "tokenSymbol",
    "isCollateral",
  ]),
  apy: ExactDecimal,
  balance: NonNegativeRiskValue,
  balanceRaw: ExactBaseUnitAmount,
  balanceUsd: NonNegativeRiskValue,
  marketId: MarketId,
  pendingActions: PendingActions,
  positionState: Schema.optionalKey(IsolatedRiskSnapshot),
  tokenAddress: TokenAddress,
});
export type SupplyBalance = typeof SupplyBalance.Type;

export const DebtBalance = Schema.Struct({
  ...Struct.pick(BorrowApi.DebtBalanceDto.fields, ["tokenSymbol"]),
  apy: ExactDecimal,
  balance: NonNegativeRiskValue,
  balanceRaw: ExactBaseUnitAmount,
  balanceUsd: NonNegativeRiskValue,
  marketId: MarketId,
  pendingActions: PendingActions,
  tokenAddress: TokenAddress,
});
export type DebtBalance = typeof DebtBalance.Type;

export const BorrowAccountSnapshot = Schema.Struct({
  address: WalletAddress,
  availableToBorrowUsd: Schema.NullOr(NonNegativeRiskValue),
  currentLtv: NonNegativeRiskValue,
  debtBalances: Schema.Array(DebtBalance),
  healthFactor: Schema.NullOr(NonNegativeRiskValue),
  integrationId: IntegrationId,
  netApy: ExactDecimal,
  netWorthUsd: ExactDecimal,
  network: BorrowNetwork,
  supplyBalances: Schema.Array(SupplyBalance),
  totalBorrowedUsd: NonNegativeRiskValue,
  totalCollateralUsd: NonNegativeRiskValue,
  totalSuppliedUsd: NonNegativeRiskValue,
});
export type BorrowAccountSnapshot = typeof BorrowAccountSnapshot.Type;
