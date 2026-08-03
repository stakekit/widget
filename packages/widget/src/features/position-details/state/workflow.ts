import BigNumber from "bignumber.js";
import { Data } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { AppToken } from "../../../domain/schema/legacy-models";
import type { YieldPendingActionType } from "../../../domain/types/pending-action";
import type { PendingActionStateKey } from "../../../domain/types/pending-action-request";
import type { YieldBalanceType } from "../../../domain/types/positions";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";

export type PositionDetailsWorkflowState = {
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
    readonly token: AppToken;
  };
};

export type PositionDetailsWorkflowAction =
  | {
      readonly type: "unstake/amount/change";
      readonly data: BigNumber;
    }
  | { readonly type: "unstake/amount/max" }
  | PendingActionAmountChange;

export const makePositionDetailsWorkflowState = (
  unstakeAmount = new BigNumber(0)
): PositionDetailsWorkflowState => ({
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
