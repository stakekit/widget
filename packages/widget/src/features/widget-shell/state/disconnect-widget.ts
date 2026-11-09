import * as Atom from "effect/reactivity/Atom";

import { walletRuntime } from "../../../runtime/wallet-runtime";
import { logoutAtom } from "../../wallet/index";

export const disconnectWidgetAtom = walletRuntime
  .fn((_input: undefined, context) => context.setResult(logoutAtom, undefined))
  .pipe(Atom.withLabel("disconnectWidgetAtom"));
