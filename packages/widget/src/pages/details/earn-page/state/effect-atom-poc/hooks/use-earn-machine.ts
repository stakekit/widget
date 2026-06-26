import { useAtom } from "@effect/atom-react";
import { earnMachineAtom } from "../machine/atoms";
import { EarnEntryKey, type EarnEntryParams } from "../types";

export const useEarnMachine = (entryParams: EarnEntryParams) => {
  const [view, dispatch] = useAtom(
    earnMachineAtom(
      new EarnEntryKey({
        ...entryParams,
      })
    )
  );

  return {
    view,
    dispatch,
  };
};
