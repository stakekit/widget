import { Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { resolveEarnView } from "../resolver/view";
import {
  type EarnEntryKey,
  type EarnMachineIntent,
  type EarnMachineView,
  makeDefaultEarnIntent,
} from "../types";
import type { EarnAction } from "./actions";
import { applyEarnAction } from "./reducer";

export const getEarnMachineAtoms = Atom.family((entry: EarnEntryKey) => {
  const intentAtom = Atom.writable<EarnMachineIntent, EarnAction>(
    (context) =>
      context
        .self<EarnMachineIntent>()
        .pipe(Option.getOrElse(makeDefaultEarnIntent)),
    (ctx, action) => {
      const intent = ctx.get(intentAtom);

      const newIntent = applyEarnAction({ action, intent });

      ctx.setSelf(newIntent);
    }
  );

  const viewAtom = Atom.readable<EarnMachineView>((context) => {
    return resolveEarnView({
      context,
      entry,
      intent: context.get(intentAtom),
    });
  });

  return {
    intentAtom,
    viewAtom,
  };
});
