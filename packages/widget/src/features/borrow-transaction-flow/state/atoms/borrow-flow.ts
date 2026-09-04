import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import type { BorrowTransactionFlowIntake } from "../../model/borrow-transaction-flow";
import { BorrowTransactionFlowService } from "../orchestration/borrow-transaction-flow-service";

export const borrowTransactionFlowServiceAtom = walletRuntime
  .atom(Effect.service(BorrowTransactionFlowService))
  .pipe(Atom.keepAlive, Atom.withLabel("borrowTransactionFlowServiceAtom"));

// Keep route admission independent of previously retained stream values.
export const makeBorrowFlowRouteSessionAtom = () =>
  walletRuntime
    .atom((context) =>
      Stream.unwrap(
        context
          .result(borrowTransactionFlowServiceAtom)
          .pipe(Effect.map((service) => service.currentSession))
      )
    )
    .pipe(Atom.withLabel("borrowFlowRouteSession"));

const currentBorrowFlowSessionResultAtom =
  makeBorrowFlowRouteSessionAtom().pipe(
    Atom.keepAlive,
    Atom.withLabel("currentBorrowFlowSessionResultAtom")
  );

export const currentBorrowFlowSessionAtom = Atom.make((get) =>
  AsyncResult.getOrElse(get(currentBorrowFlowSessionResultAtom), () => null)
).pipe(Atom.withLabel("currentBorrowFlowSessionAtom"));

export const startBorrowTransactionFlowAtom = walletRuntime
  .fn((intake: BorrowTransactionFlowIntake, context) =>
    context
      .result(borrowTransactionFlowServiceAtom)
      .pipe(Effect.flatMap((service) => service.start(intake)))
  )
  .pipe(Atom.withLabel("startBorrowTransactionFlowAtom"));
