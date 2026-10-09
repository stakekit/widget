import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import type { NavigatingClassicTransactionFlowStart } from "../../model/classic-transaction-flow";
import { ClassicTransactionFlowService } from "../orchestration/classic-transaction-flow-service";

export const classicTransactionFlowServiceAtom = walletRuntime
  .atom(Effect.service(ClassicTransactionFlowService))
  .pipe(Atom.keepAlive, Atom.withLabel("classicTransactionFlowServiceAtom"));

export const startClassicTransactionFlowAtom = walletRuntime
  .fn((input: NavigatingClassicTransactionFlowStart, context) =>
    context
      .result(classicTransactionFlowServiceAtom)
      .pipe(Effect.flatMap((service) => service.start(input)))
  )
  .pipe(Atom.withLabel("startClassicTransactionFlowAtom"));
