import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { YieldAction } from "../../../domain/schema/action-models";

import type { ActionMeta } from "../../../domain/types/wallets/generic-wallet";
import {
  getStepsMachineAtoms,
  StepsMachineAtomKey,
} from "../state/steps-machine-atoms";
import {
  initializeStepsMachine,
  StepsMachineKey,
} from "../state/steps-machine-model";

export const useStepsMachine = ({
  actionMeta,
  transactions,
  yieldId,
}: {
  readonly actionMeta: ActionMeta;
  readonly transactions: YieldAction["transactions"];
  readonly yieldId: YieldAction["yieldId"];
}) => {
  const key = new StepsMachineAtomKey({
    machineKey: new StepsMachineKey({
      actionMeta,
      transactions,
      yieldId,
    }),
  });
  const atoms = getStepsMachineAtoms(key);
  useAtomMount(atoms.completionAtom);
  const result = useAtomValue(atoms.stateAtom);
  const dispatch = useAtomSet(atoms.dispatchAtom);
  const state = Option.getOrElse(AsyncResult.value(result), () =>
    initializeStepsMachine({ transactions, yieldId })
  );

  return {
    dispatch,
    eventsAtom: atoms.eventsAtom,
    result,
    state,
  } as const;
};
