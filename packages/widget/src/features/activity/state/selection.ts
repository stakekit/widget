import * as Atom from "effect/unstable/reactivity/Atom";
import type { YieldAction } from "../../../domain/schema/action-models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import { getActionInputToken } from "../../../domain/types/action";
import {
  type ClassicTransactionWorkflowKey,
  type ClassicTransactionWorkflowProviderDetail,
  makeClassicTransactionWorkflowKey,
} from "../../../services/workflow/transaction-workflow-model";
import { selectAtom } from "../../../shared/effect/select-atom";

type ActivitySelection = {
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
  readonly selectedAction: YieldAction;
  readonly selectedValidators: ReadonlyArray<EarnValidator>;
  readonly selectedYield: EarnYieldWithProvider;
};

type ActivitySelectionState = ActivitySelection | null;

export const activitySelectionAtom = Atom.make<ActivitySelectionState>(
  null
).pipe(Atom.keepAlive, Atom.withLabel("activitySelectionAtom"));

export const activitySelectedActionAtom = selectAtom(
  activitySelectionAtom,
  (selection) => selection?.selectedAction ?? null
);

export const activitySelectedYieldAtom = selectAtom(
  activitySelectionAtom,
  (selection) => selection?.selectedYield ?? null
);

export const activitySelectedValidatorsAtom = selectAtom(
  activitySelectionAtom,
  (selection) => selection?.selectedValidators ?? null
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
        })
      : null
);
