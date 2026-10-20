import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import type { NavigatingClassicTransactionFlowStart } from "../model/classic-transaction-flow";
import { makeStartClassicTransactionFlow } from "./start-flow";

export const startClassicTransactionFlowAtom = walletRuntime
  .fn((input: NavigatingClassicTransactionFlowStart) =>
    makeStartClassicTransactionFlow.pipe(
      Effect.flatMap((start) => start(input))
    )
  )
  .pipe(Atom.withLabel("startClassicTransactionFlowAtom"));
