import { Schema } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";
import { ExactBaseUnitAmount, ExactDecimal } from "../../finance/scalars";
import { IntegrationId, MarketId, TokenAddress, WalletAddress } from "../ids";
import { BorrowNetwork } from "../network";
import { NonNegativeRiskValue, RiskRatio } from "../risk/risk-values";
import { PendingActions } from "./pending-action";

export const IsolatedRiskSnapshot = Schema.Struct({
  ...BorrowApi.PositionStateDto.fields,
  availableToBorrowUsd: NonNegativeRiskValue,
  currentLtv: NonNegativeRiskValue,
  healthFactor: Schema.NullOr(NonNegativeRiskValue),
  liquidationThreshold: RiskRatio,
});
export type IsolatedRiskSnapshot = typeof IsolatedRiskSnapshot.Type;

export const SupplyBalance = Schema.Struct({
  ...BorrowApi.SupplyBalanceDto.fields,
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
  ...BorrowApi.DebtBalanceDto.fields,
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
  ...BorrowApi.PositionDto.fields,
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
