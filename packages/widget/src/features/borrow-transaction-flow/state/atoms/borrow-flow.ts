import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import type {
  BorrowTransactionFlowIntake,
  BorrowTransactionFlowOutcome,
} from "../../model/borrow-transaction-flow";
import { BorrowTransactionFlowService } from "../orchestration/borrow-transaction-flow-service";

export const borrowTransactionFlowServiceAtom = walletRuntime
  .atom(Effect.service(BorrowTransactionFlowService))
  .pipe(Atom.keepAlive, Atom.withLabel("borrowTransactionFlowServiceAtom"));

const currentBorrowFlowSessionResultAtom = walletRuntime
  .atom((context) =>
    Stream.unwrap(
      context
        .result(borrowTransactionFlowServiceAtom)
        .pipe(Effect.map((service) => service.currentSession))
    )
  )
  .pipe(Atom.keepAlive, Atom.withLabel("currentBorrowFlowSessionResultAtom"));

export const currentBorrowFlowSessionAtom = Atom.make((get) =>
  AsyncResult.getOrElse(get(currentBorrowFlowSessionResultAtom), () => null)
).pipe(Atom.withLabel("currentBorrowFlowSessionAtom"));

const borrowTransactionFlowOutcomeResultAtom = walletRuntime
  .atom((context) =>
    Stream.unwrap(
      context
        .result(borrowTransactionFlowServiceAtom)
        .pipe(Effect.map((service) => service.latestOutcome))
    )
  )
  .pipe(Atom.keepAlive, Atom.withLabel("borrowTransactionFlowOutcomeResult"));

export const borrowTransactionFlowOutcomeAtom = Atom.make((get) =>
  AsyncResult.getOrElse(get(borrowTransactionFlowOutcomeResultAtom), () =>
    Option.none<BorrowTransactionFlowOutcome>()
  )
).pipe(Atom.withLabel("borrowTransactionFlowOutcome"));

export const startBorrowTransactionFlowAtom = walletRuntime
  .fn((intake: BorrowTransactionFlowIntake, context) =>
    context
      .result(borrowTransactionFlowServiceAtom)
      .pipe(Effect.flatMap((service) => service.start(intake)))
  )
  .pipe(Atom.withLabel("startBorrowTransactionFlowAtom"));
