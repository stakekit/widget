import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { YieldAction } from "../../../../../domain/schema/action-models";

import type { ActionMeta } from "../../../../../public-api/types";
import {
  initializeStepsMachine,
  StepsMachineKey,
} from "../../../../../services/workflow/steps-machine-model";
import { getStepsMachineAtoms } from "../state/steps-machine-atoms";

export const useStepsMachine = ({
  actionMeta,
  transactions,
  yieldId,
}: {
  readonly actionMeta: ActionMeta;
  readonly transactions: YieldAction["transactions"];
  readonly yieldId: YieldAction["yieldId"];
}) => {
  const key = new StepsMachineKey({
    actionMeta,
    transactions,
    yieldId,
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
