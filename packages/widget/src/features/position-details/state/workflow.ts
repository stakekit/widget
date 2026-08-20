import type BigNumber from "bignumber.js";
import { Data } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { PendingActionStateKey } from "../../../domain/action/action-command";
import type { YieldPendingActionType } from "../../../domain/action/pending-action";
import { exactZero } from "../../../domain/finance/exact";
import type { TokenAddress } from "../../../domain/identity/identifiers";
import type { YieldBalanceType } from "../../../domain/portfolio/positions";
import type { Token } from "../../../domain/token/token";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";

export type PositionDetailsWorkflowState = {
  readonly exitReceiveTokenAddress: TokenAddress | null;
  readonly pendingActions: Map<PendingActionStateKey, BigNumber>;
  readonly unstakeAmount: BigNumber;
  readonly unstakeUseMaxAmount: boolean;
};

export type PendingActionAmountChange = {
  readonly type: "pendingAction/amount/change";
  readonly data: {
    readonly actionType: YieldPendingActionType;
    readonly amount: BigNumber;
    readonly balanceType: YieldBalanceType;
    readonly passthrough: string;
    readonly token: Token;
  };
};

export type PositionDetailsWorkflowAction =
  | {
      readonly type: "unstake/receive-token/change";
      readonly data: TokenAddress;
    }
  | {
      readonly type: "unstake/amount/change";
      readonly data: BigNumber;
    }
  | { readonly type: "unstake/amount/max" }
  | PendingActionAmountChange;

export const makePositionDetailsWorkflowState = (
  unstakeAmount = exactZero()
): PositionDetailsWorkflowState => ({
  exitReceiveTokenAddress: null,
  pendingActions: new Map(),
  unstakeAmount,
  unstakeUseMaxAmount: false,
});

export const reducePositionDetailsWorkflow = ({
  action,
  maxUnstakeAmount,
  pendingActions,
  state,
}: {
  readonly action: PositionDetailsWorkflowAction;
  readonly maxUnstakeAmount: BigNumber;
  readonly pendingActions?: PositionDetailsWorkflowState["pendingActions"];
  readonly state: PositionDetailsWorkflowState;
}): PositionDetailsWorkflowState => {
  switch (action.type) {
    case "unstake/receive-token/change":
      return {
        ...state,
        exitReceiveTokenAddress: action.data,
      };
    case "unstake/amount/change":
      return {
        ...state,
        unstakeAmount: action.data,
        unstakeUseMaxAmount: false,
      };
    case "unstake/amount/max":
      return {
        ...state,
        unstakeAmount: maxUnstakeAmount,
        unstakeUseMaxAmount: true,
      };
    case "pendingAction/amount/change":
      return {
        ...state,
        pendingActions: pendingActions ?? state.pendingActions,
      };
  }
};

export class PositionDetailsWorkflowKey extends Data.TaggedClass(
  "PositionDetailsWorkflowKey"
)<{
  readonly balanceId: string | null;
  readonly integrationId: string | null;
  readonly pendingActionType: YieldPendingActionType | null;
  readonly scope: WalletScopeKey;
}> {}

export const positionDetailsWorkflowAtom = Atom.family(
  (_key: PositionDetailsWorkflowKey) =>
    Atom.make<PositionDetailsWorkflowState>(
      makePositionDetailsWorkflowState()
    ).pipe(Atom.withLabel("positionDetailsWorkflowAtom"))
);
