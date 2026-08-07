import * as Atom from "effect/unstable/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import { logoutAtom } from "../../wallet/state";

export const disconnectWidgetAtom = walletRuntime
  .fn((_input: undefined, context) => context.setResult(logoutAtom, undefined))
  .pipe(Atom.withLabel("disconnectWidgetAtom"));
