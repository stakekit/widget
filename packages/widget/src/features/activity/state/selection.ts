import * as Atom from "effect/unstable/reactivity/Atom";
import type { YieldAction } from "../../../domain/schema/action-models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import { getActionInputToken } from "../../../domain/types/action";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import {
  type ClassicTransactionWorkflowKey,
  type ClassicTransactionWorkflowProviderDetail,
  makeClassicTransactionWorkflowKey,
} from "../../../services/workflow/transaction-workflow-model";
import { selectAtom } from "../../../shared/effect/select-atom";
import { makeTransactionWorkflowLifecycleAtom } from "../../transaction-flow/state/workflow-lifecycle";
import { currentWalletScopeAtom } from "../../wallet/runtime/selectors";

type ActivitySelection = {
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
  readonly selectedAction: YieldAction;
  readonly selectedValidators: ReadonlyArray<EarnValidator>;
  readonly selectedYield: EarnYieldWithProvider;
  readonly walletScope: WalletScopeKey;
};

type ActivitySelectionState = ActivitySelection | null;

export const activitySelectionAtom = Atom.writable<
  ActivitySelectionState,
  ActivitySelectionState
>(
  (context) => {
    context.get(currentWalletScopeAtom);
    return null;
  },
  (context, selection) => {
    context.setSelf(selection);
  }
).pipe(Atom.keepAlive, Atom.withLabel("activitySelectionAtom"));

export const activityTransactionWorkflowLifecycleAtom =
  makeTransactionWorkflowLifecycleAtom(
    activitySelectionAtom,
    "activityTransactionWorkflowLifecycleAtom"
  );

export const activityTransactionWorkflowKeyAtom = selectAtom(
  activitySelectionAtom,
  (selection): ClassicTransactionWorkflowKey | null =>
    selection
      ? makeClassicTransactionWorkflowKey({
          action: selection.selectedAction,
          inputToken: getActionInputToken({
            actionDto: selection.selectedAction,
            yieldDto: selection.selectedYield,
          }),
          providersDetails: selection.providersDetails,
          walletScope: selection.walletScope,
        })
      : null
);
