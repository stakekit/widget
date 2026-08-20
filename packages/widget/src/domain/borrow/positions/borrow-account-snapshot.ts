import { Schema } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";
import { IntegrationId, MarketId, TokenAddress, WalletAddress } from "../ids";
import { BorrowNetwork } from "../network";
import {
  NonNegativeFiniteFromString,
  RiskRatioFromString,
} from "../risk/risk-values";
import { PendingActions } from "./pending-action";

export const IsolatedRiskSnapshot = Schema.Struct({
  ...BorrowApi.PositionStateDto.fields,
  availableToBorrowUsd: NonNegativeFiniteFromString,
  currentLtv: NonNegativeFiniteFromString,
  healthFactor: Schema.NullOr(NonNegativeFiniteFromString),
  liquidationThreshold: RiskRatioFromString,
});
export type IsolatedRiskSnapshot = typeof IsolatedRiskSnapshot.Type;

export const SupplyBalance = Schema.Struct({
  ...BorrowApi.SupplyBalanceDto.fields,
  apy: Schema.FiniteFromString,
  balance: NonNegativeFiniteFromString,
  balanceRaw: Schema.BigIntFromString,
  balanceUsd: NonNegativeFiniteFromString,
  marketId: MarketId,
  pendingActions: PendingActions,
  positionState: Schema.optionalKey(IsolatedRiskSnapshot),
  tokenAddress: TokenAddress,
});
export type SupplyBalance = typeof SupplyBalance.Type;

export const DebtBalance = Schema.Struct({
  ...BorrowApi.DebtBalanceDto.fields,
  apy: Schema.FiniteFromString,
  balance: NonNegativeFiniteFromString,
  balanceRaw: Schema.BigIntFromString,
  balanceUsd: NonNegativeFiniteFromString,
  marketId: MarketId,
  pendingActions: PendingActions,
  tokenAddress: TokenAddress,
});
export type DebtBalance = typeof DebtBalance.Type;

export const BorrowAccountSnapshot = Schema.Struct({
  ...BorrowApi.PositionDto.fields,
  address: WalletAddress,
  availableToBorrowUsd: Schema.NullOr(NonNegativeFiniteFromString),
  currentLtv: NonNegativeFiniteFromString,
  debtBalances: Schema.Array(DebtBalance),
  healthFactor: Schema.NullOr(NonNegativeFiniteFromString),
  integrationId: IntegrationId,
  netApy: Schema.FiniteFromString,
  netWorthUsd: Schema.FiniteFromString,
  network: BorrowNetwork,
  supplyBalances: Schema.Array(SupplyBalance),
  totalBorrowedUsd: NonNegativeFiniteFromString,
  totalCollateralUsd: NonNegativeFiniteFromString,
  totalSuppliedUsd: NonNegativeFiniteFromString,
});
export type BorrowAccountSnapshot = typeof BorrowAccountSnapshot.Type;
