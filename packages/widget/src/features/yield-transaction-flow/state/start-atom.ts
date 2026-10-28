import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import type { NavigatingYieldTransactionFlowStart } from "../model/yield-transaction-flow";
import { makeStartYieldTransactionFlow } from "./start-flow";

export const startYieldTransactionFlowAtom = walletRuntime
  .fn((input: NavigatingYieldTransactionFlowStart) =>
    makeStartYieldTransactionFlow.pipe(Effect.flatMap((start) => start(input)))
  )
  .pipe(Atom.withLabel("startYieldTransactionFlowAtom"));
