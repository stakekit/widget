import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import {
  actionHistoryRevisionAtom,
  resetActionHistoryRevision,
} from "../../classic-transaction-flow/state";
import { logoutAtom } from "../../wallet/state";

export const disconnectWidgetAtom = walletRuntime
  .fn((_input: undefined, context) =>
    context.setResult(logoutAtom, undefined).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          context.set(actionHistoryRevisionAtom, resetActionHistoryRevision());
        })
      )
    )
  )
  .pipe(Atom.withLabel("disconnectWidgetAtom"));
