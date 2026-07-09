import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { getEarnMachineAtoms } from "../machine/atoms";
import { EarnEntryKey, type EarnEntryParams } from "../types";

export const useEarnMachine = (entryParams: EarnEntryParams) => {
  const { viewAtom, intentAtom } = getEarnMachineAtoms(
    new EarnEntryKey({
      ...entryParams,
    })
  );

  const view = useAtomValue(viewAtom);
  const dispatch = useAtomSet(intentAtom);

  return {
    view,
    dispatch,
  };
};
