import * as Atom from "effect/unstable/reactivity/Atom";
import { resolveEarnView } from "../resolver/resolver";
import {
  type EarnEntryKey,
  type EarnMachineIntent,
  type EarnMachineView,
  makeDefaultEarnIntent,
} from "../types";
import type { EarnAction } from "./actions";
import { applyEarnAction } from "./reducer";

export const earnMachineAtom = Atom.family((entry: EarnEntryKey) => {
  const earnIntentAtom = Atom.make<EarnMachineIntent>(makeDefaultEarnIntent());

  return Atom.writable<EarnMachineView, EarnAction>(
    (context) =>
      resolveEarnView({
        context,
        entry,
        intent: context.get(earnIntentAtom),
      }),
    (ctx, action) => {
      const intent = ctx.get(earnIntentAtom);

      const newIntent = applyEarnAction({ action, intent });

      ctx.set(earnIntentAtom, newIntent);
    }
  );
});
