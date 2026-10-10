import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import type { BorrowTransactionFlowIntake } from "../../model/borrow-transaction-flow";
import { BorrowTransactionFlowService } from "../orchestration/borrow-transaction-flow-service";

export const borrowTransactionFlowServiceAtom = walletRuntime
  .atom(Effect.service(BorrowTransactionFlowService))
  .pipe(Atom.keepAlive, Atom.withLabel("borrowTransactionFlowServiceAtom"));

export const startBorrowTransactionFlowAtom = walletRuntime
  .fn((intake: BorrowTransactionFlowIntake, context) =>
    context
      .result(borrowTransactionFlowServiceAtom)
      .pipe(Effect.flatMap((service) => service.start(intake)))
  )
  .pipe(Atom.withLabel("startBorrowTransactionFlowAtom"));
