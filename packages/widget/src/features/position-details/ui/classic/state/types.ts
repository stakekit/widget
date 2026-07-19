import type BigNumber from "bignumber.js";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type { EarnYieldWithProvider } from "../../../../../domain/schema/earn-models";
import type { AppToken } from "../../../../../domain/schema/legacy-models";
import type { YieldPendingActionType } from "../../../../../domain/types/pending-action";
import type {
  PositionBalances,
  PositionBalancesByType,
} from "../../../../../domain/types/positions";
import type { WalletScopeKey } from "../../../../../services/wallet/domain/scope";

import type { pricesAtom } from "../../../../earn/resources/prices";
import type { yieldOpportunityAtom } from "../../../../earn/resources/yields";
import type { positionBalancesAtom } from "../../../../portfolio/resources/positions";
import type { useStakedOrLiquidBalance } from "../../../react/use-staked-or-liquid-balance";
export type ExtraData = {
  currentWalletScope: WalletScopeKey;
  pendingActionType: YieldPendingActionType | null;
  integrationData: EarnYieldWithProvider | null;
  positionBalances: PositionBalances | null;
  positionBalancesResult: Atom.Type<ReturnType<typeof positionBalancesAtom>>;
  yieldOpportunity: Atom.Type<ReturnType<typeof yieldOpportunityAtom>>;
  positionBalancesByType: PositionBalancesByType | null;
  stakedOrLiquidBalances: ReturnType<typeof useStakedOrLiquidBalance>;
  reducedStakedOrLiquidBalance: {
    amount: BigNumber;
    amountUsd: BigNumber;
    token: AppToken;
  } | null;
  positionBalancePrices: Atom.Type<ReturnType<typeof pricesAtom>>;
  unstakeAmountValid: boolean;
  unstakeToken: AppToken | null;
  unstakeAmountError: boolean;
  canChangeUnstakeAmount: boolean | null;
  unstakeIsGreaterOrLessIntegrationLimitError: boolean;
  minUnstakeAmount: BigNumber;
};
